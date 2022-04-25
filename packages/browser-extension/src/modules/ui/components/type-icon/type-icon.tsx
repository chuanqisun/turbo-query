import React from "react";
import { BugIcon } from "../icons/bug-icon";
import { CheckboxIcon } from "../icons/checkbox-icon";
import { CrownIcon } from "../icons/crown-icon";
import { TrophyIcon } from "../icons/trophy-icon";

export interface TypeIconProps {
  type: string;
  onClick?: React.MouseEventHandler<SVGSVGElement>;
}

export const TypeIcon: React.FC<TypeIconProps> = (props) => {
  switch (props.type) {
    case "Deliverable":
      return <TrophyIcon onClick={props.onClick} className="work-item__icon" width={16} fill="#005eff" />;
    case "Task":
      return <CheckboxIcon onClick={props.onClick} className="work-item__icon" width={16} fill="#f2cb1d" />;
    case "Scenario":
      return <CrownIcon onClick={props.onClick} className="work-item__icon" width={16} fill="#773b93" />;
    case "Bug":
      return <BugIcon onClick={props.onClick} className="work-item__icon" width={16} fill="#cc293d" />;
  }
  return <></>;
};
