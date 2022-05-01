import React, { useEffect, useRef, useState } from "react";
import { useFullyVisible } from "../../../utils/use-fully-visible";

export interface VirtualizedComponentProps {
  forceVisible?: boolean;
}

// TODO to get even more perf
// Consider removing sentinel and intersection observer once the element is revealed

export function Virtualize<WrappedComponentProps>(
  WrappedComponent: React.FC<WrappedComponentProps>
) {
  const VirtualizedComponent: React.FC<
    WrappedComponentProps & VirtualizedComponentProps
  > = (props) => {
    const [isRevealed, setIsRevealed] = useState(props.forceVisible);
    const sentinel = useRef<HTMLDivElement>(null);
    const isSentinelVisible = useFullyVisible(sentinel);

    useEffect(() => {
      if (isRevealed) return;

      setIsRevealed(!!isSentinelVisible);
    }, [isRevealed, isSentinelVisible]);

    return (
      <>
        {isRevealed ? (
          <WrappedComponent {...props} />
        ) : (
          <div ref={sentinel}></div>
        )}
      </>
    );
  };

  return VirtualizedComponent;
}
