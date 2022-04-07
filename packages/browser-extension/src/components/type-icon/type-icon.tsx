import React from "react";
import { BugIcon } from "../icons/bug-icon";
import { CheckboxIcon } from "../icons/checkbox-icon";
import { CrownIcon } from "../icons/crown-icon";
import { TrophyIcon } from "../icons/trophy-icon";

export interface TypeIconProps {
  type: string;
}

export const TypeIcon: React.FC<TypeIconProps> = (props) => {
  switch (props.type) {
    case "Deliverable":
      return <TrophyIcon className="work-item__icon" width={16} fill="#005eff" />;
    case "Task":
      return <CheckboxIcon className="work-item__icon" width={16} fill="#f2cb1d" />;
    case "Scenario":
      return <CrownIcon className="work-item__icon" width={16} fill="#773b93" />;
    case "Bug":
      return <BugIcon className="work-item__icon" width={16} fill="#cc293d" />;
  }
  return <></>;
};
