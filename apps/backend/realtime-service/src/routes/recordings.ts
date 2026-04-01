import { Router } from 'express';
import multer from 'multer';
import { supabase, db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Configurar multer para armazenar em memória (antes de enviar ao Supabase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limite por chunk
  },
  fileFilter: (req, file, cb) => {
    console.log('📼 [RECORDING] Arquivo recebido:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      encoding: file.encoding,
    });

    // Aceitar vídeo WebM, MP4 e outros formatos de vídeo/áudio
    // O navegador pode enviar diferentes mimetypes dependendo do codec
    const allowedTypes = [
      'video/webm',
      'video/mp4',
      'video/x-matroska',
      'audio/webm',
      'application/octet-stream', // Alguns navegadores enviam assim
    ];

    const isAllowed = allowedTypes.includes(file.mimetype) ||
      file.mimetype.startsWith('video/') ||
      file.mimetype.startsWith('audio/') ||
      file.originalname.endsWith('.webm');

    if (isAllowed) {
      cb(null, true);
    } else {
      console.error('❌ [RECORDING] Mimetype rejeitado:', file.mimetype);
      cb(new Error(`Formato não suportado: ${file.mimetype}. Use WebM ou MP4.`));
    }
  },
});

/**
 * POST /api/recordings/upload
 * Upload de gravação ou chunk de gravação
 */
router.post('/upload', upload.single('recording') as any, async (req, res) => {
  try {
    const file = req.file;
    const { sessionId, roomId, consultationId, chunkIndex, isFinal, timestamp } = req.body;

    // Validações
    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId é obrigatório' });
    }

    console.log('📼 [RECORDING] Upload recebido:', {
      sessionId,
      roomId,
      consultationId,
      chunkIndex,
      isFinal,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      mimeType: file.mimetype,
    });

    // Gerar caminho no bucket
    const recordingId = uuidv4();
    const datePrefix = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const isChunkFinal = isFinal === 'true';

    let filePath: string;
    if (consultationId) {
      // Se tiver consultation_id, organizar por consulta
      filePath = `${consultationId}/${datePrefix}_${isChunkFinal ? 'complete' : `chunk_${chunkIndex}`}.webm`;
    } else {
      // Senão, organizar por sessão
      filePath = `sessions/${sessionId}/${datePrefix}_${isChunkFinal ? 'complete' : `chunk_${chunkIndex}`}.webm`;
    }

    console.log('📁 [RECORDING] Salvando em:', filePath);

    // Detectar contentType correto baseado no nome do arquivo
    let contentType = 'video/webm';
    if (file.originalname.endsWith('.mp4')) {
      contentType = 'video/mp4';
    } else if (file.originalname.endsWith('.webm')) {
      contentType = 'video/webm';
    }

    console.log('📁 [RECORDING] ContentType para upload:', contentType);
    console.log('📁 [RECORDING] Tamanho do buffer:', file.buffer.length, 'bytes');

    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('consultations')
      .upload(filePath, file.buffer, {
        contentType: contentType,
        upsert: true, // Sobrescrever se existir
        cacheControl: '3600',
        duplex: 'half', // Necessário para Node.js 18+
      });

    if (uploadError) {
      console.error('❌ [RECORDING] Erro no upload para Supabase:', uploadError);
      console.error('❌ [RECORDING] Detalhes:', {
        message: uploadError.message,
        name: uploadError.name,
        cause: (uploadError as any).cause,
      });
      return res.status(500).json({
        error: 'Erro ao fazer upload',
        details: uploadError.message
      });
    }

    console.log('✅ [RECORDING] Upload para Supabase concluído:', uploadData);

    // Verificar se o arquivo realmente foi criado
    const { data: fileList, error: listError } = await supabase.storage
        .from('consultations')
      .list(filePath.split('/').slice(0, -1).join('/'));

    if (listError) {
      console.warn('⚠️ [RECORDING] Não foi possível verificar arquivo:', listError);
    } else {
      console.log('📂 [RECORDING] Arquivos no diretório:', fileList?.map(f => f.name));
    }

    // Obter URL pública ou assinada
    const { data: urlData } = supabase.storage
        .from('consultations')
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl;

    console.log('✅ [RECORDING] Upload concluído:', {
      path: uploadData?.path,
      url: publicUrl,
    });

    // Se for o arquivo final, salvar metadados no banco
    if (isChunkFinal) {
      try {
        await db.saveRecordingMetadata({
          id: recordingId,
          session_id: sessionId,
          consultation_id: consultationId || null,
          room_id: roomId,
          file_path: filePath,
          file_url: publicUrl,
          file_size: file.size,
          duration_seconds: null, // Pode ser calculado depois
          mime_type: 'video/webm',
          status: 'completed',
          created_at: new Date().toISOString(),
        });

        // Atualizar call_session com a URL da gravação
        if (sessionId) {
          await db.updateSessionRecording(sessionId, publicUrl);
        }

        console.log('💾 [RECORDING] Metadados salvos no banco');

        // Salvar audio no bucket 'audios' e url_audio na consultation
        if (consultationId) {
          try {
            const audioFileName = `consulta_${consultationId}.webm`;
            const { error: audioUploadError } = await supabase.storage
              .from('audios')
              .upload(audioFileName, file.buffer, {
                contentType: 'audio/webm',
                upsert: true,
              });

            if (audioUploadError) {
              console.error('⚠️ [RECORDING] Erro ao salvar audio no bucket audios:', audioUploadError);
            } else {
              const { data: audioUrlData } = supabase.storage
                .from('audios')
                .getPublicUrl(audioFileName);

              const audioUrl = audioUrlData?.publicUrl;
              console.log(`✅ [RECORDING] Audio salvo no bucket audios: ${audioUrl}`);

              if (audioUrl) {
                const { error: updateError } = await supabase
                  .from('consultations')
                  .update({ url_audio: audioUrl })
                  .eq('id', consultationId);

                if (updateError) {
                  console.error('⚠️ [RECORDING] Erro ao salvar url_audio:', updateError);
                } else {
                  console.log('✅ [RECORDING] url_audio salvo na consultation');
                }
              }
            }
          } catch (audioError) {
            console.error('⚠️ [RECORDING] Erro no upload audio (nao bloqueia):', audioError);
          }
        }
      } catch (dbError) {
        console.error('⚠️ [RECORDING] Erro ao salvar metadados (upload OK):', dbError);
        // Não falhar o request, upload já foi feito
      }
    }

    res.json({
      success: true,
      recordingId,
      url: publicUrl,
      path: filePath,
      size: file.size,
      isFinal: isChunkFinal,
      chunkIndex: parseInt(chunkIndex) || 0,
    });

  } catch (error) {
    console.error('❌ [RECORDING] Erro geral:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * GET /api/recordings/:sessionId
 * Lista gravações de uma sessão
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const recordings = await db.getRecordingsBySession(sessionId);

    res.json({
      success: true,
      sessionId,
      recordings,
      count: recordings.length,
    });

  } catch (error) {
    console.error('❌ [RECORDING] Erro ao listar:', error);
    res.status(500).json({
      error: 'Erro ao listar gravações',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * GET /api/recordings/consultation/:consultationId
 * Lista gravações de uma consulta
 */
router.get('/consultation/:consultationId', async (req, res) => {
  try {
    const { consultationId } = req.params;

    const recordings = await db.getRecordingsByConsultation(consultationId);

    res.json({
      success: true,
      consultationId,
      recordings,
      count: recordings.length,
    });

  } catch (error) {
    console.error('❌ [RECORDING] Erro ao listar:', error);
    res.status(500).json({
      error: 'Erro ao listar gravações',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * GET /api/recordings/download/:recordingId
 * Gera URL assinada para download
 */
router.get('/download/:recordingId', async (req, res) => {
  try {
    const { recordingId } = req.params;
    const expiresIn = parseInt(req.query.expiresIn as string) || 3600; // 1 hora padrão

    const recording = await db.getRecordingById(recordingId);

    if (!recording) {
      return res.status(404).json({ error: 'Gravação não encontrada' });
    }

    // Gerar URL assinada para download seguro
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('consultations')
      .createSignedUrl(recording.file_path, expiresIn);

    if (signedUrlError) {
      console.error('❌ [RECORDING] Erro ao gerar URL assinada:', signedUrlError);
      return res.status(500).json({ error: 'Erro ao gerar URL de download' });
    }

    res.json({
      success: true,
      recordingId,
      downloadUrl: signedUrlData?.signedUrl,
      expiresIn,
    });

  } catch (error) {
    console.error('❌ [RECORDING] Erro ao gerar download:', error);
    res.status(500).json({
      error: 'Erro ao gerar download',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * DELETE /api/recordings/:recordingId
 * Remove uma gravação
 */
router.delete('/:recordingId', async (req, res) => {
  try {
    const { recordingId } = req.params;

    const recording = await db.getRecordingById(recordingId);

    if (!recording) {
      return res.status(404).json({ error: 'Gravação não encontrada' });
    }

    // Remover do storage
    const { error: deleteError } = await supabase.storage
        .from('consultations')
      .remove([recording.file_path]);

    if (deleteError) {
      console.error('⚠️ [RECORDING] Erro ao remover do storage:', deleteError);
      // Continuar mesmo com erro no storage
    }

    // Remover do banco
    await db.deleteRecording(recordingId);

    console.log('🗑️ [RECORDING] Gravação removida:', recordingId);

    res.json({
      success: true,
      recordingId,
      message: 'Gravação removida com sucesso',
    });

  } catch (error) {
    console.error('❌ [RECORDING] Erro ao remover:', error);
    res.status(500).json({
      error: 'Erro ao remover gravação',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default router;

