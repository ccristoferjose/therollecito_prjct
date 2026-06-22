export interface MenuRef {
  id: number;
  name: string;
}
export interface AdminCategory {
  id: number;
  menu_id: number;
  name: string;
  description?: string | null;
}
export interface AdminItem {
  id: number;
  category_id: number;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  is_active: number | boolean;
}
export interface ItemLocationLink {
  item_id: number;
  location_id: number;
}
export interface AdminOption {
  id: number;
  item_id: number;
  name: string;
  is_required?: number | boolean;
}
export interface AdminOptionValue {
  id: number;
  item_option_id: number;
  name: string;
  price_modifier: number;
}
export interface MenuAdminData {
  menus: MenuRef[];
  categories: AdminCategory[];
  items: AdminItem[];
  itemLocations: ItemLocationLink[];
  options: AdminOption[];
  optionValues: AdminOptionValue[];
}
