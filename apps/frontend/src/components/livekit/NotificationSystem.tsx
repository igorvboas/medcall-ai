'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  useRoomContext, 
  useRemoteParticipants,
  useLocalParticipant 
} from '@livekit/components-react';
import { RoomEvent, ParticipantEvent } from 'livekit-client';
import { 
  CheckCircle, 
  AlertCircle, 
  Info, 
  XCircle, 
  UserPlus, 
  UserMinus,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';
import styles from './NotificationSystem.module.css';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  autoHide?: boolean;
  duration?: number;
}

interface NotificationSystemProps {
  userRole?: 'doctor' | 'patient';
}

function NotificationToast({ 
  notification, 
  onClose 
}: { 
  notification: Notification;
  onClose: (id: string) => void;
}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (notification.autoHide !== false) {
      const duration = notification.duration || 5000;
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose(notification.id), 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  const getIcon = () => {
    switch (notification.type) {
      case 'success': return <CheckCircle size={20} />;
      case 'error': return <XCircle size={20} />;
      case 'warning': return <AlertCircle size={20} />;
      case 'info': return <Info size={20} />;
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(notification.id), 300);
  };

  return (
    <div 
      className={`${styles.notificationToast} ${styles[notification.type]} ${
        isVisible ? styles.visible : styles.hidden
      }`}
    >
      <div className={styles.notificationIcon}>
        {getIcon()}
      </div>
      
      <div className={styles.notificationContent}>
        <div className={styles.notificationTitle}>
          {notification.title}
        </div>
        <div className={styles.notificationMessage}>
          {notification.message}
        </div>
        <div className={styles.notificationTimestamp}>
          {notification.timestamp.toLocaleTimeString()}
        </div>
      </div>
      
      <button 
        className={styles.closeButton}
        onClick={handleClose}
        title="Fechar notificação"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function NotificationSystem({ userRole = 'doctor' }: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const { localParticipant } = useLocalParticipant();

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    
    setNotifications(prev => [newNotification, ...prev.slice(0, 4)]); // Keep only last 5
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Room event listeners
  useEffect(() => {
    if (!room) return;

    const handleConnected = () => {
      addNotification({
        type: 'success',
        title: 'Conectado',
        message: 'Conexão estabelecida com sucesso',
        autoHide: true,
        duration: 3000
      });
    };

    const handleDisconnected = () => {
      addNotification({
        type: 'error',
        title: 'Desconectado',
        message: 'Conexão perdida com o servidor',
        autoHide: false
      });
    };

    const handleReconnecting = () => {
      addNotification({
        type: 'warning',
        title: 'Reconectando',
        message: 'Tentando reconectar ao servidor...',
        autoHide: true,
        duration: 5000
      });
    };

    const handleReconnected = () => {
      addNotification({
        type: 'success',
        title: 'Reconectado',
        message: 'Conexão reestabelecida',
        autoHide: true,
        duration: 3000
      });
    };

    const handleParticipantConnected = (participant: any) => {
      const isDoctor = participant.metadata?.includes('doctor') || participant.name?.includes('Dr');
      const participantType = isDoctor ? 'médico' : 'paciente';
      
      addNotification({
        type: 'info',
        title: 'Participante conectado',
        message: `${participant.name || 'Participante'} (${participantType}) entrou na consulta`,
        autoHide: true,
        duration: 4000
      });
    };

    const handleParticipantDisconnected = (participant: any) => {
      const isDoctor = participant.metadata?.includes('doctor') || participant.name?.includes('Dr');
      const participantType = isDoctor ? 'médico' : 'paciente';
      
      addNotification({
        type: 'warning',
        title: 'Participante desconectado',
        message: `${participant.name || 'Participante'} (${participantType}) saiu da consulta`,
        autoHide: true,
        duration: 4000
      });
    };

    const handleConnectionQualityChanged = (quality: any, participant: any) => {
      if (quality === 'poor') {
        addNotification({
          type: 'warning',
          title: 'Qualidade da conexão',
          message: `Conexão instável detectada${participant === localParticipant ? ' (sua conexão)' : ''}`,
          autoHide: true,
          duration: 5000
        });
      }
    };

    const handleDataReceived = (payload: any, participant: any) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        
        if (data.type === 'suggestion_used' && userRole === 'patient') {
          addNotification({
            type: 'info',
            title: 'Sugestão aplicada',
            message: 'O médico aplicou uma sugestão da IA',
            autoHide: true,
            duration: 3000
          });
        }
      } catch (error) {
        // Ignore non-JSON data
      }
    };

    // Add event listeners
    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.Reconnecting, handleReconnecting);
      room.off(RoomEvent.Reconnected, handleReconnected);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, localParticipant, userRole, addNotification]);

  // Track participant camera/microphone changes
  useEffect(() => {
    remoteParticipants.forEach(participant => {
      const handleTrackMuted = () => {
        addNotification({
          type: 'info',
          title: 'Participante silenciado',
          message: `${participant.name || participant.identity} desligou o microfone`,
          autoHide: true,
          duration: 3000
        });
      };

      const handleTrackUnmuted = () => {
        addNotification({
          type: 'info',
          title: 'Participante ativou áudio',
          message: `${participant.name || participant.identity} ligou o microfone`,
          autoHide: true,
          duration: 3000
        });
      };

      participant.on(ParticipantEvent.TrackMuted, handleTrackMuted);
      participant.on(ParticipantEvent.TrackUnmuted, handleTrackUnmuted);

      return () => {
        participant.off(ParticipantEvent.TrackMuted, handleTrackMuted);
        participant.off(ParticipantEvent.TrackUnmuted, handleTrackUnmuted);
      };
    });
  }, [remoteParticipants, addNotification]);

  // Medical-specific notifications
  useEffect(() => {
    // Notification for consultation start
    if (remoteParticipants.length > 0) {
      const hasAllParticipants = remoteParticipants.length === 1; // In a 2-person consultation
      
      if (hasAllParticipants) {
        addNotification({
          type: 'success',
          title: 'Consulta iniciada',
          message: userRole === 'doctor' ? 
            'Paciente conectado. Consulta pode começar.' : 
            'Médico conectado. Consulta pode começar.',
          autoHide: true,
          duration: 5000
        });
      }
    }
  }, [remoteParticipants.length, userRole, addNotification]);

  if (notifications.length === 0) return null;

  return (
    <div className={styles.notificationContainer}>
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onClose={removeNotification}
        />
      ))}
    </div>
  );
}
