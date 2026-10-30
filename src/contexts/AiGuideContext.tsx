import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface AiGuideUiState {
  screen: string | null;
  entityId: string | null;
  reasonCode: string | null;
  element: string | null;
  setEntityId: (id: string | null) => void;
}

const noopSetEntity = (_id: string | null) => {};

const AiGuideUiContext = createContext<AiGuideUiState>({
  screen: null,
  entityId: null,
  reasonCode: null,
  element: null,
  setEntityId: noopSetEntity,
});

const lotIdFromTarget = (target: EventTarget | null): string | null => {
  if (!(target instanceof Element)) return null;
  const el = target.closest("[data-lot-id], [data-lot]");
  if (!el) return null;
  const id = el.getAttribute("data-lot-id") || el.getAttribute("data-lot");
  const trimmed = id?.trim();
  return trimmed || null;
};

export const AiGuideProvider = ({
  screen,
  entityId,
  reasonCode,
  element,
  children,
}: {
  screen: string | null;
  entityId: string | null;
  reasonCode: string | null;
  element: string | null;
  children: ReactNode;
}) => {
  const [pickedLot, setPickedLot] = useState<string | null>(entityId);

  useEffect(() => {
    if (entityId) setPickedLot(entityId);
  }, [entityId]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const id = lotIdFromTarget(event.target);
      if (id) setPickedLot(id);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const setEntityId = useCallback((id: string | null) => {
    setPickedLot(id);
  }, []);

  const value = useMemo(
    () => ({
      screen: screen || null,
      entityId: pickedLot || entityId || null,
      reasonCode: reasonCode || null,
      element: element || null,
      setEntityId,
    }),
    [screen, pickedLot, entityId, reasonCode, element, setEntityId],
  );
  return <AiGuideUiContext.Provider value={value}>{children}</AiGuideUiContext.Provider>;
};

export const useAiGuideUi = () => useContext(AiGuideUiContext);
