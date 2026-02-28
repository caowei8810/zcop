import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmoothCard, SmoothButton } from '../styles/SmoothUIStyles';

interface SmoothVirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  containerHeight: number;
  keyExtractor: (item: T, index: number) => string | number;
  className?: string;
}

export const SmoothVirtualizedList = <T extends {}>({
  items,
  renderItem,
  itemHeight,
  containerHeight,
  keyExtractor,
  className = ''
}: SmoothVirtualizedListProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeightState, setContainerHeightState] = useState(containerHeight);
  
  // Calculate visible items
  const startIndex = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(containerHeightState / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 5, items.length); // +5 for buffer
  
  const visibleItems = items.slice(startIndex, endIndex);
  
  // Calculate scroll offset
  const offsetY = startIndex * itemHeight;
  
  // Handle container resize
  useEffect(() => {
    const updateHeight = () => {
      setContainerHeightState(containerHeight);
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [containerHeight]);
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  return (
    <div 
      className={`overflow-y-auto relative ${className}`}
      style={{ height: containerHeightState }}
      onScroll={handleScroll}
    >
      <div style={{ height: items.length * itemHeight, width: '100%', position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => {
            const actualIndex = startIndex + index;
            return (
              <div 
                key={keyExtractor(item, actualIndex)} 
                style={{ height: itemHeight }}
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface SmoothInfiniteScrollProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
  threshold?: number;
  itemHeight?: number;
  className?: string;
}

export const SmoothInfiniteScroll = <T extends {}>({
  items,
  renderItem,
  onLoadMore,
  hasMore,
  loading,
  threshold = 100,
  itemHeight = 100,
  className = ''
}: SmoothInfiniteScrollProps<T>) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < threshold && hasMore && !loading) {
        onLoadMore();
      }
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onLoadMore, hasMore, loading, threshold]);
  
  return (
    <div ref={containerRef} className={`overflow-y-auto ${className}`} style={{ height: '100%' }}>
      {items.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
      
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex justify-center p-4"
          >
            <div className="w-8 h-8 border-4 border-t-indigo-600 border-r-indigo-600 border-b-gray-200 border-l-gray-200 rounded-full animate-spin"></div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {!hasMore && (
        <div className="text-center p-4 text-gray-500">
          You've reached the end
        </div>
      )}
    </div>
  );
};

interface SmoothDragAndDropListProps<T> {
  items: T[];
  setItems: (items: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  className?: string;
}

export const SmoothDragAndDropList = <T extends {}>({
  items,
  setItems,
  renderItem,
  keyExtractor,
  className = ''
}: SmoothDragAndDropListProps<T>) => {
  const [draggedItem, setDraggedItem] = useState<{ item: T; index: number } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  const handleDragStart = (e: React.DragEvent, item: T, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    setDraggedItem({ item, index });
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  
  const handleDragLeave = () => {
    setDragOverIndex(null);
  };
  
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    if (draggedItem) {
      const newItems = [...items];
      const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
      
      // Remove dragged item
      const [removed] = newItems.splice(dragIndex, 1);
      // Insert at drop position
      newItems.splice(dropIndex, 0, removed);
      
      setItems(newItems);
      setDraggedItem(null);
    }
  };
  
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
  };
  
  return (
    <div className={className}>
      {items.map((item, index) => (
        <motion.div
          key={keyExtractor(item, index)}
          draggable
          onDragStart={(e) => handleDragStart(e, item, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className={`cursor-move ${dragOverIndex === index ? 'bg-gray-100' : ''}`}
          style={{
            opacity: draggedItem?.index === index ? 0.5 : 1,
            transform: draggedItem?.index === index ? 'rotate(5deg)' : 'none',
          }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </div>
  );
};

interface SmoothSearchableListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  searchFields: Array<keyof T>;
  placeholder?: string;
  className?: string;
}

export const SmoothSearchableList = <T extends {}>({
  items,
  renderItem,
  keyExtractor,
  searchFields,
  placeholder = 'Search...',
  className = ''
}: SmoothSearchableListProps<T>) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState<T[]>(items);
  
  useEffect(() => {
    if (!searchTerm) {
      setFilteredItems(items);
      return;
    }
    
    const term = searchTerm.toLowerCase();
    const filtered = items.filter(item => {
      return searchFields.some(field => {
        const value = item[field];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(term);
        }
        return false;
      });
    });
    
    setFilteredItems(filtered);
  }, [searchTerm, items, searchFields]);
  
  return (
    <div className={className}>
      <div className="mb-4">
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      
      <SmoothVirtualizedList
        items={filteredItems}
        renderItem={renderItem}
        itemHeight={60}
        containerHeight={400}
        keyExtractor={keyExtractor}
      />
    </div>
  );
};

interface SmoothFilterableListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  filters: Array<{
    id: string;
    label: string;
    predicate: (item: T) => boolean;
  }>;
  className?: string;
}

export const SmoothFilterableList = <T extends {}>({
  items,
  renderItem,
  keyExtractor,
  filters,
  className = ''
}: SmoothFilterableListProps<T>) => {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [filteredItems, setFilteredItems] = useState<T[]>(items);
  
  useEffect(() => {
    let result = [...items];
    
    if (activeFilters.size > 0) {
      result = items.filter(item => {
        return Array.from(activeFilters).some(filterId => {
          const filter = filters.find(f => f.id === filterId);
          return filter ? filter.predicate(item) : false;
        });
      });
    }
    
    setFilteredItems(result);
  }, [items, activeFilters, filters]);
  
  const toggleFilter = (filterId: string) => {
    setActiveFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filterId)) {
        newSet.delete(filterId);
      } else {
        newSet.add(filterId);
      }
      return newSet;
    });
  };
  
  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map(filter => (
          <SmoothButton
            key={filter.id}
            $variant={activeFilters.has(filter.id) ? 'primary' : 'secondary'}
            onClick={() => toggleFilter(filter.id)}
            $size="sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {filter.label}
          </SmoothButton>
        ))}
      </div>
      
      <SmoothVirtualizedList
        items={filteredItems}
        renderItem={renderItem}
        itemHeight={60}
        containerHeight={400}
        keyExtractor={keyExtractor}
      />
    </div>
  );
};

interface SmoothSortableListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  sortFields: Array<{
    id: string;
    label: string;
    selector: (item: T) => any;
    ascending?: boolean;
  }>;
  className?: string;
}

export const SmoothSortableList = <T extends {}>({
  items,
  renderItem,
  keyExtractor,
  sortFields,
  className = ''
}: SmoothSortableListProps<T>) => {
  const [sortBy, setSortBy] = useState<string>(sortFields[0]?.id || '');
  const [sortAscending, setSortAscending] = useState<boolean>(true);
  const [sortedItems, setSortedItems] = useState<T[]>(items);
  
  useEffect(() => {
    if (!sortBy) {
      setSortedItems(items);
      return;
    }
    
    const field = sortFields.find(f => f.id === sortBy);
    if (!field) {
      setSortedItems(items);
      return;
    }
    
    const sorted = [...items].sort((a, b) => {
      const aVal = field.selector(a);
      const bVal = field.selector(b);
      
      if (aVal < bVal) {
        return sortAscending ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortAscending ? 1 : -1;
      }
      return 0;
    });
    
    setSortedItems(sorted);
  }, [items, sortBy, sortAscending, sortFields]);
  
  const toggleSort = (fieldId: string) => {
    if (sortBy === fieldId) {
      setSortAscending(!sortAscending);
    } else {
      setSortBy(fieldId);
      setSortAscending(true);
    }
  };
  
  return (
    <div className={className}>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {sortFields.map(field => (
          <SmoothButton
            key={field.id}
            $variant={sortBy === field.id ? 'primary' : 'secondary'}
            onClick={() => toggleSort(field.id)}
            $size="sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {field.label}
            {sortBy === field.id && (
              <span className="ml-1">{sortAscending ? '↑' : '↓'}</span>
            )}
          </SmoothButton>
        ))}
      </div>
      
      <SmoothVirtualizedList
        items={sortedItems}
        renderItem={renderItem}
        itemHeight={60}
        containerHeight={400}
        keyExtractor={keyExtractor}
      />
    </div>
  );
};

interface SmoothCollapsibleListProps<T> {
  items: T[];
  renderItem: (item: T, index: number, isExpanded: boolean) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  className?: string;
}

export const SmoothCollapsibleList = <T extends {}>({
  items,
  renderItem,
  keyExtractor,
  className = ''
}: SmoothCollapsibleListProps<T>) => {
  const [expandedItems, setExpandedItems] = useState<Set<string | number>>(new Set());
  
  const toggleItem = (key: string | number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };
  
  return (
    <div className={className}>
      {items.map((item, index) => {
        const key = keyExtractor(item, index);
        const isExpanded = expandedItems.has(key);
        
        return (
          <div key={key} className="mb-2">
            <div 
              onClick={() => toggleItem(key)}
              className="cursor-pointer p-2 bg-gray-50 hover:bg-gray-100 rounded-md flex justify-between items-center"
            >
              <span>{typeof key === 'string' ? key : `Item ${index}`}</span>
              <motion.span
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                ▼
              </motion.span>
            </div>
            
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-2 border-l-2 border-indigo-500 bg-white">
                    {renderItem(item, index, isExpanded)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};