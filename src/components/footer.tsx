'use client';

import { Heart } from 'lucide-react';

interface FooterProps {
  variant?: 'landing' | 'dashboard';
}

export function Footer({ variant = 'landing' }: FooterProps) {
  const baseClasses = "flex items-center justify-center gap-1 text-sm transition-colors duration-200";
  
  if (variant === 'dashboard') {
    return (
      <footer className="bg-white border-t border-gray-200 py-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center">
          <span className={`${baseClasses} text-gray-500 hover:text-gray-700`}>
            Made with{' '}
            <Heart className="h-3 w-3 text-red-500 mx-1" fill="currentColor" />{' '}
            by{' '}
            <a
              href="https://pinesprojects.hashnode.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline font-medium"
            >
              pinesprojects
            </a>
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className={`${baseClasses} text-gray-300 hover:text-white`}>
            Made with{' '}
            <Heart className="h-4 w-4 text-red-500 mx-1" fill="currentColor" />{' '}
            by{' '}
            <a
              href="https://pinesprojects.hashnode.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline font-medium"
            >
              pinesprojects
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
