import React, { useEffect, useRef, useState } from "react";
import { useFullyVisible } from "../hooks/use-fully-visible";

export interface VirtualizedComponentProps {
  rootElement?: HTMLElement;
  forceVisible?: boolean;
  placeholderClassName?: string;
}

export function Virtualize<WrappedComponentProps>(WrappedComponent: React.FC<WrappedComponentProps>) {
  const VirtualizedComponent: React.FC<WrappedComponentProps & VirtualizedComponentProps> = (props) => {
    const [isRevealed, setIsRevealed] = useState(props.forceVisible);
    const sentinel = useRef<HTMLLIElement>(null);
    const isSentinelVisible = useFullyVisible(sentinel, {
      root: props.rootElement,
      rootMargin: "100px 0px",
      threshold: 0.01,
    });

    useEffect(() => {
      if (isRevealed) return;

      setIsRevealed(!!isSentinelVisible);
    }, [isRevealed, isSentinelVisible]);

    return <>{isRevealed ? <WrappedComponent {...props} /> : <li className={props.placeholderClassName} ref={sentinel}></li>}</>;
  };

  return VirtualizedComponent;
}
