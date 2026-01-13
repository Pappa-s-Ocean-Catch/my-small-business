'use client';

import { useRef, useEffect, useState } from 'react';
import { FaMapMarkerAlt, FaSpinner } from 'react-icons/fa';

// Type declarations for Google Maps API
declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (input: HTMLInputElement, options?: {
            componentRestrictions?: { country: string | string[] };
            fields?: string[];
            types?: string[];
          }) => {
            addListener: (event: string, callback: () => void) => void;
            getPlace: () => {
              address_components?: Array<{
                long_name: string;
                short_name: string;
                types: string[];
              }>;
              geometry?: {
                location?: {
                  lat: () => number;
                  lng: () => number;
                };
              };
            };
          };
        };
        event?: {
          clearInstanceListeners: (instance: unknown) => void;
        };
      };
    };
  }
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
  onInputChange?: (value: string) => void; // For manual typing
  placeholder?: string;
  className?: string;
  country?: string; // Restrict to specific country (e.g., 'au')
}

export function AddressAutocomplete({
  value,
  onChange,
  onInputChange,
  placeholder = 'Start typing your address...',
  className = '',
  country = 'au',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if Google Maps API is loaded
    if (typeof window === 'undefined' || !window.google?.maps?.places) {
      // Load Google Maps API script if not already loaded
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initializeAutocomplete;
      script.onerror = () => {
        setError('Failed to load Google Maps API. Please check your API key.');
      };
      
      // Check if script already exists
      if (!document.querySelector(`script[src*="maps.googleapis.com"]`)) {
        document.head.appendChild(script);
      } else {
        // Script exists, try to initialize
        setTimeout(initializeAutocomplete, 100);
      }
    } else {
      initializeAutocomplete();
    }

    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  const initializeAutocomplete = () => {
    if (!inputRef.current || !window.google?.maps?.places) {
      return;
    }

    try {
      if (!window.google?.maps?.places?.Autocomplete) {
        return;
      }
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: country ? { country: [country] } : undefined,
        fields: ['address_components', 'formatted_address', 'geometry'],
        types: ['address'], // Restrict to addresses only
      });

      autocomplete.addListener('place_changed', () => {
        setLoading(true);
        setError(null);

        const place = autocomplete.getPlace();

        if (!place.geometry || !place.address_components) {
          setError('No address details available for this selection.');
          setLoading(false);
          return;
        }

        // Parse address components
        let address_line1 = '';
        let address_line2 = '';
        let city = '';
        let state = '';
        let postcode = '';
        let country_code = country.toUpperCase();

        place.address_components.forEach((component) => {
          const types = component.types;

          if (types.includes('street_number')) {
            address_line1 = component.long_name + ' ';
          }
          if (types.includes('route')) {
            address_line1 += component.long_name;
          }
          if (types.includes('subpremise')) {
            address_line2 = component.long_name;
          }
          if (types.includes('locality') || types.includes('sublocality')) {
            city = component.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            state = component.short_name;
          }
          if (types.includes('postal_code')) {
            postcode = component.long_name;
          }
          if (types.includes('country')) {
            country_code = component.short_name;
          }
        });

        // Get coordinates
        const lat = place.geometry.location?.lat();
        const lng = place.geometry.location?.lng();

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

        setLoading(false);
      });

      autocompleteRef.current = autocomplete;
    } catch (err) {
      console.error('Error initializing autocomplete:', err);
      setError('Failed to initialize address autocomplete.');
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            // Allow manual typing
            if (onInputChange) {
              onInputChange(e.target.value);
            }
          }}
          placeholder={placeholder}
          className={`w-full px-3 py-2 pr-10 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white ${className}`}
          autoComplete="off"
        />
        <FaMapMarkerAlt className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        {loading && (
          <FaSpinner className="absolute right-10 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-600 animate-spin" />
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {!window.google?.maps?.places && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          Loading address autocomplete...
        </p>
      )}
    </div>
  );
}
