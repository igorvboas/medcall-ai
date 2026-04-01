'use client';

import { Stethoscope, User } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface SpeakerMappingPanelProps {
  visible: boolean;
  onMap: (mapping: { speaker_0: 'doctor' | 'patient'; speaker_1: 'doctor' | 'patient' }) => void;
  isMapped: boolean;
  onRemap: () => void;
}

export function SpeakerMappingPanel({
  visible,
  onMap,
  isMapped,
  onRemap
}: SpeakerMappingPanelProps) {
  const handleSelectDoctor = () => {
    // Speaker 0 is the doctor, so speaker 1 is the patient
    onMap({ speaker_0: 'doctor', speaker_1: 'patient' });
  };

  const handleSelectPatient = () => {
    // Speaker 0 is the patient, so speaker 1 is the doctor
    onMap({ speaker_0: 'patient', speaker_1: 'doctor' });
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {visible && !isMapped && (
          <motion.div
            key="mapping-panel"
            className="speaker-mapping-panel"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <h4 className="mapping-title">Quem e Speaker 0?</h4>
            <p className="mapping-subtitle">
              Identifique quem estava falando primeiro para melhorar a transcricao
            </p>
            <div className="mapping-buttons">
              <button
                className="mapping-btn doctor-btn"
                onClick={handleSelectDoctor}
                type="button"
              >
                <Stethoscope size={20} />
                <span>Medico</span>
              </button>
              <button
                className="mapping-btn patient-btn"
                onClick={handleSelectPatient}
                type="button"
              >
                <User size={20} />
                <span>Paciente</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isMapped && (
        <div className="remap-container">
          <button
            className="remap-btn"
            onClick={onRemap}
            type="button"
          >
            Remapear
          </button>
        </div>
      )}

      <style jsx>{`
        .speaker-mapping-panel {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          border: 1px solid #E5E7EB;
          text-align: center;
        }

        .mapping-title {
          margin: 0 0 6px 0;
          font-size: 18px;
          font-weight: 700;
          color: #1B4266;
        }

        .mapping-subtitle {
          margin: 0 0 16px 0;
          font-size: 14px;
          color: #6B7280;
        }

        .mapping-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .mapping-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mapping-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .mapping-btn:active {
          transform: translateY(0);
        }

        .doctor-btn {
          background: #1B4266;
        }

        .doctor-btn:hover {
          background: #153350;
        }

        .patient-btn {
          background: #10B981;
        }

        .patient-btn:hover {
          background: #059669;
        }

        .remap-container {
          display: flex;
          justify-content: flex-end;
          padding: 4px 0;
        }

        .remap-btn {
          background: none;
          border: none;
          font-size: 13px;
          color: #6B7280;
          cursor: pointer;
          padding: 4px 8px;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .remap-btn:hover {
          text-decoration: underline;
          color: #374151;
        }
      `}</style>
    </>
  );
}
