// ORBITAL Settings - Import Section
// Handles importing JSON settings files

import { useRef } from 'react';
import { Upload } from 'lucide-react';

interface ImportSectionProps {
  onImportSettings: (file: File) => void;
}

export function ImportSection({ onImportSettings }: ImportSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportSettings(file);
      // Reset input so same file can be imported again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={{
      padding: '16px',
      borderBottom: '1px solid rgba(255,255,255,0.1)'
    }}>
      {/* Section Header */}
      <div style={{
        fontSize: '11px',
        fontWeight: '700',
        color: '#1E90FF',
        letterSpacing: '1px',
        marginBottom: '12px',
        textTransform: 'uppercase'
      }}>
        IMPORT SETTINGS
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Import Button */}
      <button
        onClick={handleButtonClick}
        style={{
          width: '100%',
          padding: '10px',
          background: '#353a45',
          border: '1px solid #4a5563',
          borderRadius: '2px',
          color: '#1E90FF',
          fontSize: '11px',
          fontWeight: '800',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(30,144,255,.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <Upload size={14} />
        IMPORT SETTINGS FILE (JSON)
      </button>

      {/* Info Text */}
      <div style={{
        marginTop: '12px',
        fontSize: '9px',
        color: 'rgba(148,175,180,0.6)',
        lineHeight: '1.4'
      }}>
        Import previously exported settings to restore parameters and custom presets. Perfect for DJs switching between visual setups during live performances.
      </div>
    </div>
  );
}