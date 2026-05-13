'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { FaMapMarkerAlt, FaSpinner, FaSearch } from 'react-icons/fa';
import { Icon } from './Icon';

// Type declarations for Google Maps API
declare global {
  interface Window {
    google?: any;
  }
}

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: {
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    latitude?: number;
    longitude?: number;
  }) => void;
  onInputChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  country?: string; // e.g., 'au'
}

export function AddressAutocomplete({
  value,
  onChange,
  onInputChange,
  placeholder = 'Start typing your address...',
  className = '',
  country = 'au',
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const autocompleteService = useRef<any>(null);
  const placesService = useRef<any>(null);

  // Initialize Services
  const initServices = useCallback(() => {
    if (window.google?.maps?.places) {
      if (!autocompleteService.current) {
        autocompleteService.current = new window.google.maps.places.AutocompleteService();
      }
      if (!placesService.current) {
        // PlacesService needs a dummy element
        const dummy = document.createElement('div');
        placesService.current = new window.google.maps.places.PlacesService(dummy);
      }
    }
  }, []);

  useEffect(() => {
    // Load Script if not exists
    if (typeof window !== 'undefined' && !window.google?.maps?.places) {
      if (!document.querySelector(`script[src*="maps.googleapis.com"]`)) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = initServices;
        document.head.appendChild(script);
      } else {
        const check = setInterval(() => {
          if (window.google?.maps?.places) {
            initServices();
            clearInterval(check);
          }
        }, 100);
        setTimeout(() => clearInterval(check), 5000);
      }
    } else {
      initServices();
    }
  }, [initServices]);

  // Handle clicking outside to close predictions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPredictions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPredictions = useCallback(async (input: string) => {
    if (!input || input.length < 3 || !autocompleteService.current) {
      setPredictions([]);
      return;
    }

    setLoading(true);
    try {
      autocompleteService.current.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: [country] },
          types: ['address']
        },
        (results: any[], status: string) => {
          if (status === 'OK' && results) {
            setPredictions(results);
            setShowPredictions(true);
            setError(null);
          } else {
            setPredictions([]);
          }
          setLoading(false);
        }
      );
    } catch (err) {
      console.error('Autocomplete service error:', err);
      setLoading(false);
    }
  }, [country]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (onInputChange) onInputChange(newValue);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (newValue.length >= 3) {
      searchTimeout.current = setTimeout(() => {
        fetchPredictions(newValue);
      }, 300);
    } else {
      setPredictions([]);
      setShowPredictions(false);
    }
  };

  const handleSelectPrediction = async (prediction: Prediction) => {
    if (!placesService.current) return;
    
    setLoading(true);
    setShowPredictions(false);
    
    try {
      placesService.current.getDetails(
        {
          placeId: prediction.place_id,
          fields: ['address_components', 'geometry', 'formatted_address']
        },
        (result: any, status: string) => {
          if (status === 'OK' && result) {
            // Parse address components
            let street_number = '';
            let route = '';
            let address_line2 = '';
            let city = '';
            let state = '';
            let postcode = '';
            let country_code = 'AU';

            result.address_components.forEach((component: any) => {
              const types = component.types;
              if (types.includes('street_number')) street_number = component.long_name;
              if (types.includes('route')) route = component.long_name;
              if (types.includes('subpremise')) address_line2 = component.long_name;
              if (types.includes('locality') || types.includes('sublocality')) city = component.long_name;
              if (types.includes('administrative_area_level_1')) state = component.short_name;
              if (types.includes('postal_code')) postcode = component.long_name;
              if (types.includes('country')) country_code = component.short_name;
            });

            const lat = result.geometry.location.lat();
            const lng = result.geometry.location.lng();
            const address_line1 = street_number ? `${street_number} ${route}` : route;

            onChange({
              address_line1: address_line1.trim(),
              address_line2: address_line2 || undefined,
              city,
              state,
              postcode,
              country: country_code,
              latitude: lat,
              longitude: lng,
            });
          } else {
            setError('Failed to load address details');
          }
          setLoading(false);
          setPredictions([]);
        }
      );
    } catch (err) {
      console.error('Details service error:', err);
      setLoading(false);
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`w-full px-4 py-3 pr-10 border border-gray-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all ${className}`}
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {loading ? (
            <Icon icon={FaSpinner} className="w-4 h-4 text-blue-600 animate-spin" />
          ) : (
            <Icon icon={FaSearch} className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {showPredictions && predictions.length > 0 && (
        <div className="absolute z-[9999] w-full mt-2 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <ul className="max-h-64 overflow-y-auto">
            {predictions.map((prediction) => (
              <li key={prediction.place_id}>
                <button
                  type="button"
                  onClick={() => handleSelectPrediction(prediction)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-neutral-700/50 flex items-start gap-3 transition-colors border-b border-gray-100 dark:border-neutral-700 last:border-0"
                >
                  <Icon icon={FaMapMarkerAlt} className="w-4 h-4 text-blue-500 mt-1 shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      {prediction.structured_formatting.main_text}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {prediction.structured_formatting.secondary_text}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {mounted && typeof window !== 'undefined' && !window.google?.maps?.places && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          Initializing address service...
        </p>
      )}
    </div>
  );
}
