import { useEffect } from 'react';
import { EmulatorAdapter, GBAButton } from '../emulator/EmulatorAdapter';
import { AppSettings, KeyMapping } from '../storage/db';

interface UseKeyboardControlsProps {
  adapter: EmulatorAdapter | null;
  settings: AppSettings;
  isActive: boolean;
  isModalOpen: boolean;
}

export function useKeyboardControls({
  adapter,
  settings,
  isActive,
  isModalOpen,
}: UseKeyboardControlsProps): void {
  useEffect(() => {
    if (!adapter || !isActive || isModalOpen) {
      if (adapter) {
        adapter.releaseSource('keyboard');
      }
      return;
    }

    const mapping = settings.keyMapping;

    // Constrói mapa inverso de código de tecla para botão GBA
    const codeToButton = new Map<string, GBAButton>();
    (Object.keys(mapping) as Array<keyof KeyMapping>).forEach((btnKey) => {
      const code = mapping[btnKey];
      if (code && GBAButton[btnKey] !== undefined) {
        codeToButton.set(code, GBAButton[btnKey]);
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em campos de formulário
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const button = codeToButton.get(e.code);
      if (button !== undefined) {
        e.preventDefault();
        adapter.setButtonState(button, true, 'keyboard');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const button = codeToButton.get(e.code);
      if (button !== undefined) {
        e.preventDefault();
        adapter.setButtonState(button, false, 'keyboard');
      }
    };

    const handleBlur = () => {
      adapter.releaseSource('keyboard');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      adapter.releaseSource('keyboard');
    };
  }, [adapter, settings.keyMapping, isActive, isModalOpen]);
}
