"use client";

import { useState, useEffect, useRef } from "react";
import { getSupabaseClient } from "@my-small-business/supabase/client";
import { LoadingPage } from "@/components/Loading";
import { FaTrash, FaArrowUp, FaArrowDown, FaUpload } from "react-icons/fa";
import Image from "next/image";

type TVMenu = {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  sort_order: number;
};

export default function TVMenuAdminPage() {
  const [menus, setMenus] = useState<TVMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = getSupabaseClient();

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tv_menus')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setMenus(data || []);
    } catch (error: any) {
      alert(`Error fetching menus: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      
      setUploading(true);
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${ext}`;
      const filePath = `menus/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('tv_menus')
        .upload(filePath, file, {
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tv_menus')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('tv_menus').insert({
        name: file.name,
        url: publicUrl,
        is_active: true,
        sort_order: menus.length,
      });

      if (dbError) throw dbError;

      fetchMenus();
    } catch (error: any) {
      alert(`Upload Error: ${error.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const deleteMenu = async (id: string, url: string) => {
    if (!confirm('Are you sure you want to delete this menu?')) return;
    
    try {
      const { error: dbError } = await supabase.from('tv_menus').delete().eq('id', id);
      if (dbError) throw dbError;

      const filePathMatch = url.match(/tv_menus\/(.+)$/);
      if (filePathMatch && filePathMatch[1]) {
        await supabase.storage.from('tv_menus').remove([filePathMatch[1]]);
      }

      fetchMenus();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('tv_menus')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      setMenus(menus.map(m => m.id === id ? { ...m, is_active: !currentStatus } : m));
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const moveOrder = async (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === menus.length - 1)) {
      return;
    }

    const newMenus = [...menus];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newMenus[index];
    newMenus[index] = newMenus[swapIndex];
    newMenus[swapIndex] = temp;

    newMenus[index].sort_order = index;
    newMenus[swapIndex].sort_order = swapIndex;

    setMenus(newMenus);

    try {
      await supabase.from('tv_menus').update({ sort_order: index }).eq('id', newMenus[index].id);
      await supabase.from('tv_menus').update({ sort_order: swapIndex }).eq('id', newMenus[swapIndex].id);
    } catch (error: any) {
      alert('Failed to update ordering');
      fetchMenus();
    }
  };

  if (loading) {
    return <LoadingPage message="Loading TV Menus..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">TV Menus</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage the images displayed on the TV screens.</p>
          </div>
          
          <div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
            >
              {uploading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <FaUpload />
              )}
              {uploading ? 'Uploading...' : 'Upload Image'}
            </button>
          </div>
        </div>

        {menus.length === 0 ? (
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-12 text-center border border-gray-200 dark:border-neutral-700">
            <p className="text-gray-500 dark:text-gray-400">No menus found. Upload your first menu image to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {menus.map((menu, index) => (
              <div 
                key={menu.id} 
                className="bg-white dark:bg-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 border border-gray-200 dark:border-neutral-700 shadow-sm"
              >
                <div className="relative w-full sm:w-40 h-24 bg-gray-100 dark:bg-neutral-700 rounded-lg overflow-hidden flex-shrink-0">
                  <Image 
                    src={menu.url} 
                    alt={menu.name} 
                    fill 
                    className="object-cover" 
                    unoptimized
                  />
                </div>
                
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white truncate" title={menu.name}>
                    {menu.name}
                  </h3>
                  
                  <div className="mt-2 flex items-center justify-center sm:justify-start gap-3">
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only" 
                          checked={menu.is_active}
                          onChange={() => toggleActive(menu.id, menu.is_active)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${menu.is_active ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${menu.is_active ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <span className={`ml-3 text-sm font-medium ${menu.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                        {menu.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-1 mr-2">
                    <button 
                      onClick={() => moveOrder(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-neutral-700 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move up"
                    >
                      <FaArrowUp />
                    </button>
                    <button 
                      onClick={() => moveOrder(index, 'down')}
                      disabled={index === menus.length - 1}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-neutral-700 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move down"
                    >
                      <FaArrowDown />
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => deleteMenu(menu.id, menu.url)}
                    className="p-3 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
