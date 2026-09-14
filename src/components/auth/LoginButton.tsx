interface LoginButtonProps {
  onClick: () => void;
  disabled: boolean;
  pending: boolean;
}

export function LoginButton({ onClick, disabled, pending }: LoginButtonProps) {
  return (
    <button type="button" className="app-button-secondary auth-google" onClick={onClick} disabled={disabled}>
      {pending ? 'Connecting…' : 'Sign in with Google'}
    </button>
  );
}
