import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from '@mantine/core';
import { adminLoginSchema } from '@expense/shared';
import { useLogin } from '../../hooks/useAuth';
import { getApiErrorMessage, notifySuccess } from '../../lib/queryClient';
import { useAppSelector } from '../../store';
import { getPalette } from '../../constants/themeColors';
import { ROUTES } from '../../constants';
import PasswordInput from '../../components/common/PasswordInput';
import PixelBlast from '../../components/effects/PixelBlast';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const themeColor = useAppSelector((state) => state.common.themeColor);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(adminLoginSchema) });

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? ROUTES.HOME;

  const onSubmit = handleSubmit((data) =>
    login.mutate(data, {
      onSuccess: ({ admin }) => {
        notifySuccess(`Welcome back, ${admin.name}`);
        navigate(from, { replace: true });
      },
    }),
  );

  return (
    <div className="login-page min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="login-page__bg" aria-hidden="true">
        <PixelBlast
          variant="circle"
          pixelSize={6}
          color={getPalette(themeColor).accent}
          patternScale={3}
          patternDensity={1.2}
          pixelSizeJitter={0.5}
          enableRipples
          rippleSpeed={0.4}
          rippleThickness={0.12}
          rippleIntensityScale={1.5}
          liquid
          liquidStrength={0.12}
          liquidRadius={1.2}
          liquidWobbleSpeed={5}
          speed={0.6}
          edgeFade={0.25}
          transparent
        />
      </div>
      <div className="login-page__overlay" aria-hidden="true" />

      <div className="login-page__content w-full max-w-md">
        <div className="bg-transparent border-2 border-white/20 backdrop-blur-[13px] px-6 py-8 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)]">
          <div className="text-center mb-4">
            <img src="/expensehog-logo.png" alt="expenseHog" className="h-12 w-auto object-contain inline-block mb-3" />
            <p className="text-white/90 text-lg mt-1">Admin Panel</p>
          </div>
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Sign In</h2>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="userName" className="block text-sm font-medium text-white/90 mb-1">
                Username
              </label>
              <input
                id="userName"
                type="text"
                className="login-input"
                placeholder="Enter your username"
                autoComplete="username"
                {...register('userName')}
              />
              {errors.userName && <p className="text-red-400 text-xs mt-1">{errors.userName.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-1">
                Password
              </label>
              <PasswordInput
                id="password"
                className="login-input login-input--with-toggle"
                toggleClassName="text-white hover:text-white focus:ring-white/40"
                placeholder="Enter your password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {login.isError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                {getApiErrorMessage(login.error, 'Login failed')}
              </div>
            )}

            <button type="submit" disabled={login.isPending} className="login-submit-btn">
              {login.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader size={16} color="white" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
