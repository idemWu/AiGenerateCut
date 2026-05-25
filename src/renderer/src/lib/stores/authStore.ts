import { create } from "zustand";

/** 认证抽屉：登录 / 注册（同表单、仅文案不同） */
export type AuthDrawerView = "login" | "register";

interface AuthState {
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** init() 是否已执行过 */
  initialized: boolean;
  /** access token */
  token: string | null;
  /** 当前用户 uid */
  uid: string | null;
  /** 当前用户完整资料 */
  profile: null;
  /** 正在加载用户信息 */
  profileLoading: boolean;
  /** 是否已通过邀请码激活 */
  isInvited: boolean;
  /** 是否显示邀请码弹窗 */
  showInviteDialog: boolean;
  /** 是否显示登录抽屉（全局，供未登录时点击关注/私信等触发） */
  loginDrawerOpen: boolean;
  /** 抽屉为登录或注册文案 */
  authDrawerView: AuthDrawerView;
  /** 登录成功后待执行的回调 */
  pendingLoginAction: (() => void) | null;

  /** 登录成功后调用：保存 token，拉取用户信息 */
  login: (token: string, uid: string, isInvited: boolean) => Promise<void>;
  /** 退出登录 */
  logout: () => void;
  /** 拉取 / 刷新用户信息 */
  fetchProfile: () => Promise<void>;
  /** 静默刷新 profile（不设 loading，用于进入个人页时更新关注/粉丝数等） */
  refreshProfileSilent: () => Promise<void>;
  /** 本地更新 profile 字段（乐观更新） */
  updateProfileLocal: () => void;
  /** 标记为已激活 */
  setInvited: () => void;
  /** 打开邀请码弹窗 */
  openInviteDialog: () => void;
  /** 打开登录抽屉，可传入登录成功后的回调 */
  openLoginDrawer: (onSuccess?: () => void) => void;
  /** 打开注册视角的同一抽屉（流程与登录一致，仅文案为注册） */
  openRegisterDrawer: (onSuccess?: () => void) => void;
  /** 关闭登录抽屉 */
  closeLoginDrawer: () => void;
  /** 初始化：从 localStorage 恢复登录状态 */
  init: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  initialized: false,
  token: null,
  uid: null,
  profile: null,
  profileLoading: false,
  isInvited: false,
  showInviteDialog: false,
  loginDrawerOpen: false,
  authDrawerView: "login",
  pendingLoginAction: null,

  login: async (token: string, uid: string, isInvited: boolean) => {
    localStorage.setItem("access_token", token);
    localStorage.setItem("user_uid", uid);
    localStorage.setItem("is_invited", String(isInvited));
    set({
      isLoggedIn: true,
      token,
      uid,
      isInvited,
      showInviteDialog: false,
    });
    await get().fetchProfile();
    const pending = get().pendingLoginAction;
    if (pending) {
      set({ pendingLoginAction: null });
      pending();
    }
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_uid");
    localStorage.removeItem("is_invited");
    set({
      isLoggedIn: false,
      token: null,
      uid: null,
      profile: null,
      isInvited: false,
      showInviteDialog: false,
    });
  },

  fetchProfile: async () => {
    set({ profileLoading: false });
  },

  refreshProfileSilent: async () => {
    set({ profile: null });
  },

  updateProfileLocal: () => {},

  setInvited: () => {
    localStorage.setItem("is_invited", "true");
    set({ isInvited: true, showInviteDialog: false });
  },

  openInviteDialog: () => {
    set({ showInviteDialog: true });
  },

  openLoginDrawer: (onSuccess?: () => void) => {
    set({
      loginDrawerOpen: true,
      authDrawerView: "login",
      pendingLoginAction: onSuccess ?? null,
    });
  },

  openRegisterDrawer: (onSuccess?: () => void) => {
    set({
      loginDrawerOpen: true,
      authDrawerView: "register",
      pendingLoginAction: onSuccess ?? null,
    });
  },

  closeLoginDrawer: () => {
    set({
      loginDrawerOpen: false,
      pendingLoginAction: null,
      authDrawerView: "login",
    });
  },

  init: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("access_token");
    const uid = localStorage.getItem("user_uid");
    const isInvited = localStorage.getItem("is_invited") === "true";
    if (token && uid) {
      set({
        isLoggedIn: true,
        initialized: true,
        token,
        uid,
        isInvited,
        showInviteDialog: false,
      });
      get().fetchProfile();
    } else {
      set({ initialized: true });
    }
  },
}));
