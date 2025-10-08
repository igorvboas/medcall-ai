'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Camera, Loader2, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import './AvatarUpload.css';

interface AvatarUploadProps {
  currentImageUrl?: string | null;
  onUploadComplete: (url: string) => void;
  userId: string;
  userType: 'medico' | 'paciente';
  size?: 'small' | 'medium' | 'large';
}

export function AvatarUpload({
  currentImageUrl,
  onUploadComplete,
  userId,
  userType,
  size = 'medium'
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setError(null);
      const file = event.target.files?.[0];
      
      if (!file) return;

      // Validações
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        setError('A imagem deve ter no máximo 5MB');
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Formato de imagem não suportado. Use JPG, PNG ou WEBP');
        return;
      }

      // Mostrar preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload para o Supabase
      setUploading(true);

      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${userType}_${userId}_${Date.now()}.${fileExt}`;
      const filePath = `${userType}s/${fileName}`;

      // Upload do arquivo
      const { error: uploadError, data } = await supabase.storage
        .from('profile_pics')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('profile_pics')
        .getPublicUrl(filePath);

      // Atualizar tabela correspondente
      const tableName = userType === 'medico' ? 'medicos' : 'patients';
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ profile_pic: publicUrl })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      // Callback de sucesso
      onUploadComplete(publicUrl);
      
    } catch (err: any) {
      console.error('Erro ao fazer upload:', err);
      setError(err.message || 'Erro ao fazer upload da imagem');
      setPreview(currentImageUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`avatar-upload avatar-upload--${size}`}>
      <div className="avatar-upload__container" onClick={handleClick}>
        {preview ? (
          <Image
            src={preview}
            alt="Avatar"
            fill
            className="avatar-upload__image"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="avatar-upload__placeholder">
            <User size={size === 'large' ? 48 : size === 'medium' ? 32 : 24} />
          </div>
        )}
        
        <div className="avatar-upload__overlay">
          {uploading ? (
            <Loader2 className="avatar-upload__icon avatar-upload__icon--loading" />
          ) : (
            <Camera className="avatar-upload__icon" />
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg,image/webp"
        onChange={handleFileSelect}
        disabled={uploading}
        className="avatar-upload__input"
      />

      {error && (
        <p className="avatar-upload__error">{error}</p>
      )}
    </div>
  );
}

