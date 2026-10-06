import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { STORAGE_KEYS } from '../../constants';
import { DEFAULT_THEME_COLOR, isThemeKey } from '../../constants/themeColors';

export type ColorScheme = 'light' | 'dark';

const storedScheme = localStorage.getItem(STORAGE_KEYS.THEME);
const storedThemeColor = localStorage.getItem(STORAGE_KEYS.THEME_COLOR);

interface CommonState {
  theme: ColorScheme;
  /** Cached copy of the server's app-wide theme, so the right colors paint before it loads. */
  themeColor: string;
}

const initialState: CommonState = {
  theme: storedScheme === 'dark' ? 'dark' : 'light',
  themeColor: isThemeKey(storedThemeColor) ? storedThemeColor : DEFAULT_THEME_COLOR,
};

const commonSlice = createSlice({
  name: 'common',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<ColorScheme>) => {
      state.theme = action.payload;
      localStorage.setItem(STORAGE_KEYS.THEME, action.payload);
    },
    setThemeColor: (state, action: PayloadAction<string>) => {
      // Unknown keys (e.g. a theme removed from the kit) fall back to the default.
      state.themeColor = isThemeKey(action.payload) ? action.payload : DEFAULT_THEME_COLOR;
      localStorage.setItem(STORAGE_KEYS.THEME_COLOR, state.themeColor);
    },
  },
});

export const { setTheme, setThemeColor } = commonSlice.actions;
export default commonSlice.reducer;
