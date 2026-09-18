// Shape of menu_publications.snapshot as built by publish_menu().

export interface SnapshotChoice {
  id: string;
  name: string;
  price_delta_minor: number;
  position: number;
}

export interface SnapshotOptionGroup {
  id: string;
  name: string;
  selection_type: string;
  position: number;
  choices: SnapshotChoice[];
}

export interface SnapshotItem {
  id: string;
  name: string;
  description: string | null;
  price_minor: number;
  photo_path: string | null;
  is_available: boolean;
  tags: string[];
  position: number;
  option_groups: SnapshotOptionGroup[];
}

export interface SnapshotSubsection {
  id: string;
  name: string;
  position: number;
  items: SnapshotItem[];
}

export interface SnapshotSection extends SnapshotSubsection {
  subsections: SnapshotSubsection[];
}

export interface MenuSnapshot {
  venue: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    default_locale: string;
  };
  menu: {
    id: string;
    name: string;
  };
  sections: SnapshotSection[];
}
