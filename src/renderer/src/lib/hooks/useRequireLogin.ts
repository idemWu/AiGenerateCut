"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/lib/stores/authStore";

/**
 * 要求登录后再执行操作的 Hook。
 * 未登录时打开登录抽屉，不执行 action，返回 false；
 * 已登录时执行 action（若有）并返回 true。
 * 用于关注、私信、点赞等需要登录的按钮，统一弹出登录窗口而非报错或跳转。
 *
 * @returns requireLogin(action?) - 调用时：未登录则打开登录抽屉并返回 false；已登录则执行 action 并返回 true
 */
export function useRequireLogin(): (
  action?: () => void | Promise<void>
) => boolean | Promise<boolean> {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const openLoginDrawer = useAuthStore((s) => s.openLoginDrawer);

  return useCallback(
    (action?: () => void | Promise<void>): boolean | Promise<boolean> => {
      if (!isLoggedIn) {
        openLoginDrawer(action ? () => { action(); } : undefined);
        return false;
      }
      if (action) {
        const result = action();
        if (result instanceof Promise) {
          return result.then(() => true);
        }
        return true;
      }
      return true;
    },
    [isLoggedIn, openLoginDrawer]
  );
}
