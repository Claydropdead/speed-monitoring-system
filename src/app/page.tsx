import Link from 'next/link';
import { Activity, Zap, Users, Building } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Speed Test Monitor</h1>
            </div>
            <Link href="/auth/signin" className="btn-primary">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900 sm:text-6xl">
            Monitor Internet Speed
            <span className="block text-blue-600">Across Multiple Offices</span>
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
            Track internet speed performance with automated testing three times daily. Get insights
            into download speeds, upload speeds, ping, and more for each office location.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link href="/auth/signin" className="btn-primary text-lg px-8 py-3">
              Get Started
            </Link>
            <Link
              href="#features"
              className="text-lg font-semibold leading-6 text-gray-900 hover:text-blue-600"
            >
              Learn more <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="mt-32">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
            <div className="card text-center">
              <div className="card-content">
                <Zap className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Automated Testing</h3>
                <p className="text-gray-600">
                  Run speed tests automatically three times daily - morning, noon, and afternoon.
                </p>
              </div>
            </div>

            <div className="card text-center">
              <div className="card-content">
                <Building className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Multi-Office Support</h3>
                <p className="text-gray-600">
                  Track performance across multiple office locations with different ISPs.
                </p>
              </div>
            </div>

            <div className="card text-center">
              <div className="card-content">
                <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Role-Based Access</h3>
                <p className="text-gray-600">
                  Office users see their own data, admins get a comprehensive view of all locations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
