'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Eye,
  Trash2,
  PenTool,
  FolderOpen,
  Loader2,
  FileText,
  ExternalLink,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import { gatewayClient } from '@/lib/gatewayClient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import './documentos.css';

interface Documento {
  id: string;
  nome: string;
  descricao: string | null;
  url: string;
  tipo: string;
  zapsign_status: 'pending' | 'signed' | 'refused' | 'link_opened' | 'waiting';
  zapsign_sign_url: string | null;
  zapsign_signed_url: string | null;
  zapsign_doc_token: string | null;
  patients: { name: string } | null;
  created_at: string;
  updated_at: string;
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  waiting: 'Aguardando assinatura',
  signed: 'Assinado',
  refused: 'Recusado',
  link_opened: 'Link aberto',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock size={12} />,
  waiting: <Loader2 size={12} />,
  signed: <CheckCircle size={12} />,
  refused: <XCircle size={12} />,
  link_opened: <ExternalLink size={12} />,
};

export default function DocumentosPage() {
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteModal, setDeleteModal] = useState<Documento | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [signing, setSigning] = useState<string | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNome, setUploadNome] = useState('');
  const [uploadDescricao, setUploadDescricao] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Viewer modal state
  const [viewerDoc, setViewerDoc] = useState<Documento | null>(null);
  const [viewerSigning, setViewerSigning] = useState(false);

  const fetchDocumentos = useCallback(async () => {
    setLoading(true);
    const response = await gatewayClient.get('/documentos');
    if (response.success && response.data) {
      setDocumentos(response.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      fetchDocumentos();
    }
  }, [user, fetchDocumentos]);

  // Polling: atualiza a lista quando há documentos aguardando assinatura
  useEffect(() => {
    const hasWaiting = documentos.some(
      (d) => d.zapsign_status === 'waiting' || d.zapsign_status === 'link_opened'
    );
    if (!hasWaiting) return;

    const interval = setInterval(async () => {
      const response = await gatewayClient.get('/documentos');
      if (response.success && response.data) {
        setDocumentos(response.data);
        // Atualizar viewer se aberto
        if (viewerDoc) {
          const updated = response.data.find((d: Documento) => d.id === viewerDoc.id);
          if (updated) setViewerDoc(updated);
        }
      }
    }, 10000); // Polling a cada 10 segundos

    return () => clearInterval(interval);
  }, [documentos, viewerDoc]);

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);

    const response = await gatewayClient.delete(`/documentos/${deleteModal.id}`);
    if (response.success) {
      setDocumentos((prev) => prev.filter((d) => d.id !== deleteModal.id));
      // Fechar viewer se o doc deletado estava aberto
      if (viewerDoc?.id === deleteModal.id) setViewerDoc(null);
    }

    setDeleting(false);
    setDeleteModal(null);
  };

  const handleSign = async (doc: Documento) => {
    setSigning(doc.id);

    const response = await gatewayClient.post(`/documentos/${doc.id}/sign`);
    if (response.success && response.data?.sign_url) {
      window.open(response.data.sign_url, '_blank');

      setDocumentos((prev) =>
        prev.map((d) =>
          d.id === doc.id
            ? { ...d, zapsign_status: 'waiting' as const, zapsign_sign_url: response.data.sign_url }
            : d
        )
      );

      // Atualizar viewer se aberto
      if (viewerDoc?.id === doc.id) {
        setViewerDoc((prev) =>
          prev ? { ...prev, zapsign_status: 'waiting', zapsign_sign_url: response.data.sign_url } : null
        );
      }
    }

    setSigning(null);
  };

  const handleViewerSign = async () => {
    if (!viewerDoc) return;
    setViewerSigning(true);

    const response = await gatewayClient.post(`/documentos/${viewerDoc.id}/sign`);
    if (response.success && response.data?.sign_url) {
      window.open(response.data.sign_url, '_blank');

      const updated = { ...viewerDoc, zapsign_status: 'waiting' as const, zapsign_sign_url: response.data.sign_url };
      setViewerDoc(updated);
      setDocumentos((prev) => prev.map((d) => (d.id === viewerDoc.id ? updated : d)));
    }

    setViewerSigning(false);
  };

  const handleCheckStatus = async (doc: Documento) => {
    const response = await gatewayClient.get(`/documentos/${doc.id}/status`);
    if (response.success && response.data) {
      const updater = (d: Documento) =>
        d.id === doc.id
          ? { ...d, zapsign_status: response.data.status, zapsign_signed_url: response.data.signed_url }
          : d;

      setDocumentos((prev) => prev.map(updater));
      if (viewerDoc?.id === doc.id) {
        setViewerDoc((prev) =>
          prev
            ? { ...prev, zapsign_status: response.data.status, zapsign_signed_url: response.data.signed_url }
            : null
        );
      }
    }
  };

  const handleView = (doc: Documento) => {
    setViewerDoc(doc);
  };

  // Upload handlers
  const resetUploadModal = () => {
    setShowUploadModal(false);
    setUploadFile(null);
    setUploadNome('');
    setUploadDescricao('');
    setDragOver(false);
  };

  const handleFileSelect = (file: File) => {
    setUploadFile(file);
    if (!uploadNome) {
      setUploadNome(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile || !uploadNome) return;
    setUploading(true);

    try {
      // Upload para Supabase Storage
      const timestamp = Date.now();
      const filePath = `documentos/${user?.id}/${timestamp}_${uploadFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('[Upload] Erro:', uploadError);
        setUploading(false);
        return;
      }

      // Obter URL pública
      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) {
        console.error('[Upload] Erro ao obter URL pública');
        setUploading(false);
        return;
      }

      // Detectar tipo
      const ext = uploadFile.name.split('.').pop()?.toLowerCase() || '';
      const tipo = ext === 'pdf' ? 'PDF'
        : ['jpg', 'jpeg', 'png'].includes(ext) ? 'Imagem'
        : ['doc', 'docx'].includes(ext) ? 'Documento'
        : ext.toUpperCase();

      // Criar registro no backend
      const response = await gatewayClient.post('/documentos', {
        nome: uploadNome,
        descricao: uploadDescricao || null,
        url: publicUrlData.publicUrl,
        tipo,
      });

      if (response.success && response.data) {
        setDocumentos((prev) => [response.data, ...prev]);
      }

      resetUploadModal();
    } catch (err) {
      console.error('[Upload] Erro:', err);
    }

    setUploading(false);
  };

  const filteredDocs = documentos.filter((doc) =>
    doc.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.patients?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getViewerUrl = (doc: Documento) => doc.zapsign_signed_url || doc.url;

  return (
    <div className="documentos-container">
      <div className="documentos-header">
        <h1>Documentos</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="documentos-search">
            <Search size={16} color="#9ca3af" />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="doc-add-btn" onClick={() => setShowUploadModal(true)}>
            <Plus size={18} />
            Adicionar
          </button>
        </div>
      </div>

      <div className="documentos-table-wrapper">
        {loading ? (
          <div className="doc-loading">
            <div className="doc-spinner" />
            Carregando documentos...
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="doc-empty">
            <div className="doc-empty-icon">
              <FolderOpen size={48} />
            </div>
            <h3>{searchTerm ? 'Nenhum documento encontrado' : 'Nenhum documento'}</h3>
            <p>
              {searchTerm
                ? 'Tente buscar com outros termos.'
                : 'Clique em "Adicionar" para enviar seu primeiro documento.'}
            </p>
          </div>
        ) : (
          <table className="documentos-table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Paciente</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={16} color="#6b7280" />
                      <span style={{ fontWeight: 500 }}>{doc.nome}</span>
                    </div>
                  </td>
                  <td>{doc.patients?.name || '—'}</td>
                  <td>{doc.tipo}</td>
                  <td>
                    <span className={`doc-status-badge ${doc.zapsign_status}`}>
                      {statusIcons[doc.zapsign_status]}
                      {statusLabels[doc.zapsign_status] || doc.zapsign_status}
                    </span>
                  </td>
                  <td>{formatDate(doc.created_at)}</td>
                  <td>
                    <div className="doc-actions">
                      <button
                        className="doc-action-btn"
                        title="Visualizar documento"
                        onClick={() => handleView(doc)}
                      >
                        <Eye size={16} />
                      </button>

                      {doc.zapsign_status !== 'signed' && (
                        <button
                          className="doc-action-btn sign"
                          title="Assinar documento"
                          onClick={() => handleSign(doc)}
                          disabled={signing === doc.id}
                        >
                          {signing === doc.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <PenTool size={16} />
                          )}
                        </button>
                      )}

                      {(doc.zapsign_status === 'waiting' || doc.zapsign_status === 'link_opened') && (
                        <button
                          className="doc-action-btn"
                          title="Verificar status da assinatura"
                          onClick={() => handleCheckStatus(doc)}
                        >
                          <AlertTriangle size={16} />
                        </button>
                      )}

                      {doc.zapsign_status === 'signed' && doc.zapsign_signed_url && (
                        <button
                          className="doc-action-btn"
                          title="Baixar documento assinado"
                          onClick={() => window.open(doc.zapsign_signed_url!, '_blank')}
                        >
                          <CheckCircle size={16} color="#065f46" />
                        </button>
                      )}

                      <button
                        className="doc-action-btn delete"
                        title="Excluir documento"
                        onClick={() => setDeleteModal(doc)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Upload */}
      {showUploadModal && (
        <div className="doc-modal-overlay" onClick={() => !uploading && resetUploadModal()}>
          <div className="doc-modal doc-upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="doc-modal-header">
              <h3>Adicionar documento</h3>
              <button className="doc-close-btn" onClick={resetUploadModal} disabled={uploading}>
                <X size={18} />
              </button>
            </div>

            <div
              className={`doc-dropzone ${dragOver ? 'drag-over' : ''} ${uploadFile ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              {uploadFile ? (
                <div className="doc-file-preview">
                  <FileText size={24} color="#1B4266" />
                  <span>{uploadFile.name}</span>
                  <span className="doc-file-size">
                    {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              ) : (
                <>
                  <Upload size={32} color="#9ca3af" />
                  <p>Arraste um arquivo ou clique para selecionar</p>
                  <span className="doc-dropzone-hint">PDF, DOC, DOCX, JPG, PNG</span>
                </>
              )}
            </div>

            <div className="doc-form-group">
              <label>Nome do documento</label>
              <input
                type="text"
                value={uploadNome}
                onChange={(e) => setUploadNome(e.target.value)}
                placeholder="Ex: Prescrição médica"
              />
            </div>

            <div className="doc-form-group">
              <label>Descrição (opcional)</label>
              <input
                type="text"
                value={uploadDescricao}
                onChange={(e) => setUploadDescricao(e.target.value)}
                placeholder="Ex: Prescrição para paciente João"
              />
            </div>

            <div className="doc-modal-actions">
              <button className="doc-modal-btn" onClick={resetUploadModal} disabled={uploading}>
                Cancelar
              </button>
              <button
                className="doc-modal-btn primary"
                onClick={handleUploadSubmit}
                disabled={!uploadFile || !uploadNome || uploading}
              >
                {uploading ? (
                  <>
                    <div className="doc-spinner" style={{ width: 14, height: 14 }} />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Enviar documento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Viewer com opção de assinar */}
      {viewerDoc && (
        <div className="doc-modal-overlay" onClick={() => setViewerDoc(null)}>
          <div className="doc-viewer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="doc-viewer-header">
              <div className="doc-viewer-title">
                <FileText size={20} />
                <h3>{viewerDoc.nome}</h3>
                <span className={`doc-status-badge ${viewerDoc.zapsign_status}`}>
                  {statusIcons[viewerDoc.zapsign_status]}
                  {statusLabels[viewerDoc.zapsign_status]}
                </span>
              </div>
              <div className="doc-viewer-actions">
                {viewerDoc.zapsign_status !== 'signed' && (
                  <button
                    className="doc-modal-btn primary"
                    onClick={handleViewerSign}
                    disabled={viewerSigning}
                  >
                    {viewerSigning ? (
                      <>
                        <div className="doc-spinner" style={{ width: 14, height: 14 }} />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <PenTool size={14} />
                        Assinar com ZapSign
                      </>
                    )}
                  </button>
                )}
                {(viewerDoc.zapsign_status === 'waiting' || viewerDoc.zapsign_status === 'link_opened') && (
                  <button
                    className="doc-modal-btn"
                    onClick={() => handleCheckStatus(viewerDoc)}
                  >
                    <AlertTriangle size={14} />
                    Verificar status
                  </button>
                )}
                <button
                  className="doc-modal-btn"
                  onClick={() => window.open(getViewerUrl(viewerDoc), '_blank')}
                >
                  <ExternalLink size={14} />
                  Abrir em nova aba
                </button>
                <button className="doc-close-btn" onClick={() => setViewerDoc(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="doc-viewer-content">
              <iframe
                src={getViewerUrl(viewerDoc)}
                title={viewerDoc.nome}
                className="doc-viewer-iframe"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {deleteModal && (
        <div className="doc-modal-overlay" onClick={() => !deleting && setDeleteModal(null)}>
          <div className="doc-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Excluir documento</h3>
            <p>
              Tem certeza que deseja excluir o documento <strong>{deleteModal.nome}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="doc-modal-actions">
              <button
                className="doc-modal-btn"
                onClick={() => setDeleteModal(null)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                className="doc-modal-btn danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
