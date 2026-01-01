import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiX, FiFileText, FiMapPin, FiGrid, FiLayers } from 'react-icons/fi';
import { searchApi, type SearchResult } from '../api/client';
import './SearchBar.css';

interface SearchBarProps {
  placeholder?: string;
}

export default function SearchBar({ placeholder = 'Søg efter KKS, terminal, lokation...' }: SearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      const { data } = await searchApi.search(query);
      if (data) {
        setResults(data.results);
        setIsOpen(data.results.length > 0);
      }
      setIsLoading(false);
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }

  function handleSelect(result: SearchResult) {
    navigate(result.url);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  }

  function clearSearch() {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function getTypeIcon(type: SearchResult['type']) {
    switch (type) {
      case 'annotation':
        return <FiLayers />;
      case 'terminal':
        return <FiGrid />;
      case 'location':
        return <FiMapPin />;
      case 'diagram':
        return <FiFileText />;
    }
  }

  function getTypeLabel(type: SearchResult['type']) {
    switch (type) {
      case 'annotation':
        return 'Rør';
      case 'terminal':
        return 'Terminal';
      case 'location':
        return 'Lokation';
      case 'diagram':
        return 'Diagram';
    }
  }

  function getStatusClass(status?: string) {
    if (!status) return '';
    return `status-${status}`;
  }

  return (
    <div className="search-bar-container" ref={containerRef}>
      <div className="search-bar">
        <FiSearch className="search-icon" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="search-input"
        />
        {isLoading && <div className="search-spinner" />}
        {query && !isLoading && (
          <button className="search-clear" onClick={clearSearch}>
            <FiX />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="search-dropdown">
          {results.map((result, index) => (
            <div
              key={`${result.type}-${result.id}`}
              className={`search-result ${index === selectedIndex ? 'selected' : ''} ${getStatusClass(result.status)}`}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="result-icon">{getTypeIcon(result.type)}</div>
              <div className="result-content">
                <div className="result-title">
                  {result.title}
                  {result.terminal_code && (
                    <span className="result-terminal-badge">{result.terminal_code}</span>
                  )}
                </div>
                <div className="result-subtitle">{result.subtitle}</div>
              </div>
              <div className="result-type">{getTypeLabel(result.type)}</div>
            </div>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="search-dropdown">
          <div className="search-no-results">
            Ingen resultater for "{query}"
          </div>
        </div>
      )}
    </div>
  );
}
