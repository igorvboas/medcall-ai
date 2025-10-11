'use client';

import React, { useState, useCallback } from 'react';
import { Upload, X, File, CheckCircle, AlertCircle } from 'lucide-react';

export interface UploadedFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  url?: string;
  error?: string;
}

interface FileUploadProps {
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  maxSizePerFile?: number; // em MB
  disabled?: boolean;
}

export default function FileUpload({
  onFilesChange,
  maxFiles = 10,
  acceptedTypes = ['image/*', 'application/pdf', '.doc', '.docx'],
  maxSizePerFile = 10,
  disabled = false
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFile = (file: File): string | null => {
    // Verificar tamanho
    if (file.size > maxSizePerFile * 1024 * 1024) {
      return `Arquivo muito grande. Máximo: ${maxSizePerFile}MB`;
    }

    // Verificar tipo (simplificado)
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type;
    
    const isAccepted = acceptedTypes.some(type => {
      if (type.startsWith('.')) {
        return fileExtension === type;
      }
      if (type.endsWith('/*')) {
        return mimeType.startsWith(type.replace('/*', '/'));
      }
      return mimeType === type;
    });

    if (!isAccepted) {
      return 'Tipo de arquivo não permitido';
    }

    return null;
  };

  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles: UploadedFile[] = [];
    const errors: string[] = [];

    newFiles.forEach(file => {
      if (files.length + validFiles.length >= maxFiles) {
        errors.push(`Máximo de ${maxFiles} arquivos permitidos`);
        return;
      }

      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        return;
      }

      validFiles.push({
        file,
        id: Math.random().toString(36).substr(2, 9),
        progress: 0,
        status: 'pending'
      });
    });

    if (errors.length > 0) {
      console.error('Erros de validação:', errors);
      // Aqui você pode mostrar um toast ou alerta
    }

    const updatedFiles = [...files, ...validFiles];
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  }, [files, maxFiles, maxSizePerFile, acceptedTypes, onFilesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, [disabled, addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
    
    // Limpar o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  }, [disabled, addFiles]);

  const removeFile = useCallback((fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  }, [files, onFilesChange]);

  const updateFileStatus = useCallback((fileId: string, updates: Partial<UploadedFile>) => {
    const updatedFiles = files.map(f => 
      f.id === fileId ? { ...f, ...updates } : f
    );
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  }, [files, onFilesChange]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="w-full">
      {/* Área de Drop */}
      <div 
        className={`file-upload-dropzone ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="file-upload-icon" />
        <div>
          <h3 className="file-upload-title">
            Upload de Arquivos
          </h3>
          <p className="file-upload-subtitle">
            Arraste e solte os arquivos aqui ou clique para selecionar
          </p>
          <p className="file-upload-constraints">
            Máximo {maxFiles} arquivos, {maxSizePerFile}MB cada
          </p>
        </div>
        <button
          type="button"
          className="file-upload-button"
          disabled={disabled}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          Selecionar Arquivos
        </button>
        <input
          id="file-input"
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* Lista de Arquivos */}
      {files.length > 0 && (
        <div className="file-list">
          <h4 className="file-list-title">
            Arquivos Selecionados ({files.length})
          </h4>
          {files.map((file) => (
            <div key={file.id} className="file-item">
              <div className="file-item-info">
                <div className={`file-item-icon ${file.status}`}>
                  {getStatusIcon(file.status)}
                </div>
                <div className="file-item-details">
                  <p className="file-item-name">
                    {file.file.name}
                  </p>
                  <p className="file-item-size">
                    {formatFileSize(file.file.size)}
                  </p>
                  {file.error && (
                    <p className="file-item-error">{file.error}</p>
                  )}
                </div>
              </div>
              <div className="file-item-actions">
                {file.status === 'uploading' && (
                  <div className="file-item-progress">
                    <div 
                      className="file-item-progress-bar"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
                <button
                  type="button"
                  className="file-item-remove"
                  onClick={() => removeFile(file.id)}
                  disabled={file.status === 'uploading'}
                >
                  <X />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Hook para usar o componente
export const useFileUpload = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const updateFile = (fileId: string, updates: Partial<UploadedFile>) => {
    setUploadedFiles(prev => 
      prev.map(f => f.id === fileId ? { ...f, ...updates } : f)
    );
  };

  const clearFiles = () => {
    setUploadedFiles([]);
  };

  return {
    uploadedFiles,
    setUploadedFiles,
    updateFile,
    clearFiles
  };
};
