import { useState, type ComponentPropsWithRef } from 'react';
import { IconEye, IconEyeOff } from '@tabler/icons-react';

type Props = ComponentPropsWithRef<'input'> & { toggleClassName?: string };

export default function PasswordInput({ className = '', toggleClassName = '', ref, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={`${className.includes('login-input') ? '' : 'input-field pr-10'} ${className}`.trim()}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        className={`absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded focus:outline-none focus:ring-2 ${
          toggleClassName || 'text-gray-400 hover:text-gray-600 focus:ring-primary-500'
        }`}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <IconEyeOff size={18} stroke={1.5} /> : <IconEye size={18} stroke={1.5} />}
      </button>
    </div>
  );
}
