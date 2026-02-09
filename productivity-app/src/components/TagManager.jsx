import React, { useState, useRef } from 'react';
import { X, Check, Pipette, Trash2, AlertCircle, Save, Plus } from 'lucide-react';

const PRESETS = [
  '#8B5CF6', '#10B981', '#3B82F6', '#F59E0B', 
  '#EF4444', '#EC4899', '#06B6D4', '#6366F1'
];

const TagManager = ({ isOpen, onClose, tags, setTags }) => {
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESETS[0]);
  

  const [editingTagId, setEditingTagId] = useState(null); 
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  const colorInputRef = useRef(null); 

  if (!isOpen) return null;



  const resetForm = () => {
    setNewTagName('');
    setSelectedColor(PRESETS[0]);
    setEditingTagId(null);
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    
    const newTag = {
      id: Date.now().toString(),
      name: newTagName,
      color: selectedColor
    };

    setTags([...tags, newTag]);
    resetForm();
  };

  const handleUpdateTag = () => {
    if (!newTagName.trim()) return;

    setTags(tags.map(tag => 
      tag.id === editingTagId 
        ? { ...tag, name: newTagName, color: selectedColor }
        : tag
    ));
    resetForm();
  };

  const startEditing = (tag) => {
    setEditingTagId(tag.id);
    setNewTagName(tag.name);
    setSelectedColor(tag.color);
    setDeleteConfirmId(null); 
  };

  const confirmDelete = (id) => {
    setTags(tags.filter(t => t.id !== id));
    setDeleteConfirmId(null);
    if (editingTagId === id) resetForm(); 
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[650px] h-[420px] bg-[#0F131C] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        
        <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-[#151922]">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span className="text-[#F59E0B]">🏷️</span> Manage Tags
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          
          <div className="w-48 border-r border-white/5 bg-[#12161F] flex flex-col">
             <div className="p-3 border-b border-white/5 flex justify-between items-center">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Your Tags</div>
                <div className="text-[10px] text-gray-600">Click to edit</div>
             </div>
             
             <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {tags.length === 0 && (
                <div className="text-xs text-gray-600 text-center py-4 italic">No tags yet</div>
              )}
              
              {tags.map(tag => (
                <div 
                    key={tag.id} 
                    onClick={() => deleteConfirmId !== tag.id && startEditing(tag)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-md transition-all cursor-pointer border ${
                        deleteConfirmId === tag.id 
                            ? 'bg-red-500/10 border-red-500/20 cursor-default' 
                            : editingTagId === tag.id 
                                ? 'bg-[#1E2330] border-blue-500/50 shadow-inner' // Highlight active edit
                                : 'hover:bg-white/5 border-transparent'
                    }`}
                >
                  {deleteConfirmId === tag.id ? (
                      <div className="flex items-center justify-between w-full animate-in fade-in duration-200">
                          <div className="flex items-center gap-1.5 text-red-400">
                              <AlertCircle size={12} />
                              <span className="text-xs font-medium">Sure?</span>
                          </div>
                          <div className="flex items-center gap-1">
                              <button 
                                  onClick={(e) => { e.stopPropagation(); confirmDelete(tag.id); }}
                                  className="p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition-colors"
                              >
                                  <Check size={12} />
                              </button>
                              <button 
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                                  className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                              >
                                  <X size={12} />
                              </button>
                          </div>
                      </div>
                  ) : (
                      <>
                        <div className="flex items-center gap-2 overflow-hidden">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                            <span className={`text-xs truncate ${editingTagId === tag.id ? 'text-white font-medium' : 'text-gray-300'}`}>
                                {tag.name}
                            </span>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(tag.id); }}
                            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-1"
                        >
                            <Trash2 size={12} />
                        </button>
                      </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 p-5 bg-[#0F131C] flex flex-col">
            
            <div className="flex justify-between items-center border-b border-white/5 mb-5 pb-2">
                <div className={`text-xs font-medium transition-colors border-b-2 pb-2 px-1 ${editingTagId ? 'text-emerald-400 border-emerald-500' : 'text-blue-400 border-blue-500'}`}>
                    {editingTagId ? 'Edit Tag' : 'Create New Tag'}
                </div>
                
                {editingTagId && (
                    <button 
                        onClick={resetForm}
                        className="text-[10px] text-gray-500 hover:text-white transition-colors pb-2"
                    >
                        Cancel Edit
                    </button>
                )}
            </div>

            <div className="space-y-5 flex-1">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Tag Name</label>
                <div className="flex items-center gap-3">
                    <input 
                        type="text" 
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Project Name..."
                        className="flex-1 bg-[#151922] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
                        autoFocus
                    />
                    <div 
                        className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center shadow-inner"
                        style={{ backgroundColor: selectedColor }}
                    >
                         <div className="w-2 h-2 bg-white/20 rounded-full" />
                    </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2">Tag Color</label>
                <div className="grid grid-cols-6 gap-2 w-max">
                  {PRESETS.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center border border-transparent ${selectedColor === color ? 'ring-1 ring-white ring-offset-1 ring-offset-[#0F131C] scale-110' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  
                  <div className="relative">
                      <button
                        onClick={() => colorInputRef.current?.click()}
                        className={`w-6 h-6 rounded-full bg-[#1E2330] border border-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors ${!PRESETS.includes(selectedColor) ? 'ring-1 ring-white ring-offset-1 ring-offset-[#0F131C] border-transparent' : ''}`}
                      >
                        <Pipette size={12} />
                      </button>
                      <input 
                        ref={colorInputRef}
                        type="color" 
                        value={selectedColor}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
                <button 
                    onClick={editingTagId ? handleUpdateTag : handleAddTag}
                    disabled={!newTagName.trim()}
                    className={`w-full py-2.5 rounded-lg text-xs font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2
                        ${!newTagName.trim() 
                            ? 'bg-[#1E2330] text-gray-600 cursor-not-allowed shadow-none' 
                            : editingTagId 
                        
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-900/20 hover:shadow-emerald-900/40' 
                             
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-900/20 hover:shadow-blue-900/40'
                        }`}
                >
                    {editingTagId ? <Save size={14} /> : <Plus size={14} />}
                    {editingTagId ? 'Save Changes' : 'Create Tag'}
                </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default TagManager;