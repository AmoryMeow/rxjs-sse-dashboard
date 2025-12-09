import { useEffect, useState } from "react";
import type { Observable } from "rxjs";

export const useObservable = <T>(observable$: Observable<T>, initial: T): T => {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const sub = observable$.subscribe({
      next: setValue,
      error: (err) => {
        console.error("Observable error:", err);
      },
    });

    return () => sub.unsubscribe();
  }, [observable$]);

  return value;
};
