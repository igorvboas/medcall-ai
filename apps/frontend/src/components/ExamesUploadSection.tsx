'use client';

import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import FileUpload, { useFileUpload, UploadedFile } from './FileUpload';

interface ExamesUploadSectionProps {
  consultaId: string;
  consultaStatus: string;
  consultaEtapa: string;
  disabled?: boolean;
}

export default function ExamesUploadSection({
  consultaId,
  consultaStatus,
  consultaEtapa,
  disabled = false
}: ExamesUploadSectionProps) {
  const { uploadedFiles, setUploadedFiles, updateFile, clearFiles } = useFileUpload();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Verificar se deve mostrar a seção
  const shouldShowSection = consultaStatus === 'VALIDATION' && consultaEtapa === 'ANAMNESE';
  
  if (!shouldShowSection) {
    return null;
  }

  const handleFilesChange = (files: UploadedFile[]) => {
    setUploadedFiles(files);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleProcessExames = async () => {
    if (uploadedFiles.length === 0) {
      setErrorMessage('Por favor, selecione pelo menos um arquivo para processar.');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('uploading');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      console.log('🔍 DEBUG [REFERENCIA] Iniciando processamento de exames');

      // Processar exames (faz tudo: upload, alterar status, salvar links, chamar webhook)
      const formData = new FormData();
      uploadedFiles.forEach(file => {
        formData.append('files', file.file);
      });

      setProcessingStatus('processing');

      const processResponse = await fetch(`/api/processar-exames/${consultaId}`, {
        method: 'POST',
        body: formData,
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.error || 'Erro no processamento dos exames');
      }

      const processResult = await processResponse.json();
      console.log('✅ Processamento concluído:', processResult);

      setProcessingStatus('success');
      setSuccessMessage(processResult.message || 'Exames processados com sucesso!');
      
      // Limpar arquivos após sucesso
      clearFiles();

      // Recarregar a página para atualizar o status da consulta
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('❌ Erro no processamento:', error);
      setProcessingStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido no processamento');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = () => {
    switch (processingStatus) {
      case 'uploading':
        return <Upload className="h-4 w-4 animate-pulse" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getButtonText = () => {
    switch (processingStatus) {
      case 'uploading':
        return 'Enviando Arquivos...';
      case 'processing':
        return 'Processando Exames...';
      case 'success':
        return 'Processado com Sucesso';
      case 'error':
        return 'Tentar Novamente';
      default:
        return 'Processar Exames';
    }
  };

  return (
    <div className="exames-upload-container">
      <div className="exames-upload-header">
        <h3 className="exames-upload-title">
          <FileText />
          Upload de Exames Laboratoriais
        </h3>
      </div>
      <div className="exames-upload-content">
        <div className="exames-upload-description">
          <p>Faça upload dos exames laboratoriais do paciente para processamento automatizado.</p>
          <p>
            <strong>Formatos aceitos:</strong> PDF, DOC, DOCX, JPG, PNG (máximo 10MB por arquivo, até 50 arquivos)
          </p>
        </div>

        <FileUpload
          onFilesChange={handleFilesChange}
          maxFiles={50}
          maxSizePerFile={10}
          acceptedTypes={['application/pdf', '.doc', '.docx', 'image/jpeg', 'image/png']}
          disabled={disabled || isProcessing}
        />

        {errorMessage && (
          <div className="exames-upload-alert error">
            <AlertCircle />
            <div>{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="exames-upload-alert success">
            <CheckCircle />
            <div>{successMessage}</div>
          </div>
        )}

        <div className="exames-upload-process">
          <button
            onClick={handleProcessExames}
            disabled={disabled || isProcessing || uploadedFiles.length === 0}
            className={`exames-upload-process-button ${processingStatus === 'uploading' || processingStatus === 'processing' ? 'loading' : ''}`}
          >
            {getStatusIcon()}
            {getButtonText()}
          </button>
        </div>

        {processingStatus === 'success' && (
          <div className="exames-upload-success">
            <p>A página será recarregada automaticamente...</p>
          </div>
        )}
      </div>
    </div>
  );
}
