import React from "react";

export interface SVGIconProps {
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
}

export type SVGIconComponent = React.FC<React.SVGProps<SVGSVGElement>>;
