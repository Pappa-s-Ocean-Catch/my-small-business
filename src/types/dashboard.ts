export type User = {
  id: string;
  email: string;
  role_slug: 'admin' | 'staff';
};

export type Shift = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  staff_id: string;
  staff: {
    name: string;
    email: string;
  };
};

export type BusinessStats = {
  totalStaff: number;
  totalShifts: number;
  lowStockProducts: number;
  totalProducts: number;
  totalCategories: number;
  totalSuppliers: number;
  weeklyCost: number;
};
