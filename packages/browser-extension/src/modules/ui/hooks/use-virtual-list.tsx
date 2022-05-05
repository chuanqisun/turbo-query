import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useVirtualList() {
  const revealCallbacks = useRef(new WeakMap<Element, () => any>());
  const [observer, setObserver] = useState<IntersectionObserver>();

  const virtualListRef = useRef<HTMLElement>();
  const [containerNode, setContainerNode] = useState<HTMLElement>();

  const setVirtualListRef = useCallback((node) => {
    setContainerNode(node);
    virtualListRef.current = node;
  }, []);

  useEffect(() => {
    if (!containerNode) return;

    // setup observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.intersectionRatio > 0)
          .forEach((entry) => {
            revealCallbacks.current.get(entry.target)?.();
          });
      },
      {
        root: containerNode,
        rootMargin: "50% 0px", // load 50% above and below
        threshold: 0.01,
      }
    );

    setObserver(observer);

    return () => {
      // cleanup observer
      observer.disconnect();
    };
  }, [containerNode]);

  const VirtualListItem = useMemo<React.FC<VirtualListItemProps>>(
    () => (props) => {
      const [isVisible, setIsVisible] = useState(props.forceVisible);
      const sentinel = useRef<HTMLLIElement>(null);

      useEffect(() => {
        if (observer && !isVisible && sentinel.current) {
          const observeTarget = sentinel.current;
          revealCallbacks.current.set(sentinel.current, () => setIsVisible(true));
          observer.observe(sentinel.current);

          return () => {
            observer.unobserve(observeTarget);
          };
        }
      }, [observer]);

      return isVisible ? <>{props.children}</> : <li ref={sentinel} className={props.placeholderClassName}></li>;
    },
    [observer]
  );

  return {
    VirtualListItem,
    setVirtualListRef,
    virtualListRef,
  };
}

export interface VirtualListItemProps {
  forceVisible?: boolean;
  placeholderClassName?: string;
}
