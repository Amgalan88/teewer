"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/app/actions/types";

type Props = {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  confirmText?: string;
  resetOnOk?: boolean;
};

// Серверийн үйлдлийг дуудаж, алдаа/амжилтын мессежийг харуулна.
// onSubmit-аар дуудаж буй нь React 19 алдаа гарсан үед маягтыг хоослохоос сэргийлнэ.
export function ActionForm({ action, children, className, confirmText, resetOnOk }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnOk) ref.current?.reset();
  }, [state, resetOnOk]);

  return (
    <form
      ref={ref}
      className={className}
      // JS ачаалагдахаас өмнө илгээгдвэл GET-ээр нууц үг URL-д гарахаас сэргийлнэ
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmText && !window.confirm(confirmText)) return;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(fd));
      }}
    >
      <fieldset disabled={pending} className="bare">
        {children}
      </fieldset>
      {state?.error && (
        <p className="alert error" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="alert ok">{state.ok}</p>}
    </form>
  );
}
