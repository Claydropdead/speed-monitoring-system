'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { 
  Building,
  Users,
  Activity,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Globe,
  X,
  Eye,
  EyeOff
} from 'lucide-react';

interface Office {
  id: string;
  unitOffice: string;
  subUnitOffice?: string;
  location: string;
  isp: string; // Primary ISP (for backward compatibility)
  isps?: string; // JSON string of all ISPs
  description?: string;
  parentId?: string;
  parent?: Office;
  subUnits?: Office[];
  _count: {
    speedTests: number;
    users: number;
  };
}

interface NewOffice {
  unitOffice: string;
  subUnitOffice?: string;
  location: string;
  isp: string; // Primary ISP
  isps: string[]; // Array of all ISPs
  description: string;
  userEmail: string;
  userName: string;
  userPassword: string;
}

interface OfficeUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminOfficesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);  const [formData, setFormData] = useState<NewOffice>({
    unitOffice: '',
    subUnitOffice: '',
    location: '',
    isp: '',
    isps: [''], // Start with one empty ISP
    description: '',
    userEmail: '',
    userName: '',
    userPassword: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [viewingUsers, setViewingUsers] = useState<string | null>(null);
  const [officeUsers, setOfficeUsers] = useState<OfficeUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingOffice, setEditingOffice] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Office>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Helper functions for managing ISPs
  const addISPField = () => {
    setFormData({ ...formData, isps: [...formData.isps, ''] });
  };

  const removeISPField = (index: number) => {
    if (formData.isps.length > 1) {
      const newISPs = formData.isps.filter((_, i) => i !== index);
      setFormData({ ...formData, isps: newISPs });
    }
  };

  const updateISPField = (index: number, value: string) => {
    const newISPs = [...formData.isps];
    newISPs[index] = value;
    setFormData({ ...formData, isps: newISPs });
    
    // Update primary ISP to be the first non-empty ISP
    if (index === 0 || !formData.isp) {
      setFormData({ ...formData, isps: newISPs, isp: value || newISPs.find(isp => isp.trim()) || '' });
    }
  };

  // Helper functions for edit form ISPs
  const addEditISPField = () => {
    const currentISPs = getEditISPsArray();
    setEditFormData({ ...editFormData, isps: JSON.stringify([...currentISPs, '']) });
  };

  const removeEditISPField = (index: number) => {
    const currentISPs = getEditISPsArray();
    if (currentISPs.length > 1) {
      const newISPs = currentISPs.filter((_, i) => i !== index);
      setEditFormData({ ...editFormData, isps: JSON.stringify(newISPs) });
    }
  };

  const updateEditISPField = (index: number, value: string) => {
    const currentISPs = getEditISPsArray();
    currentISPs[index] = value;
    setEditFormData({ ...editFormData, isps: JSON.stringify(currentISPs) });
    
    // Update primary ISP to be the first non-empty ISP
    if (index === 0 || !editFormData.isp) {
      setEditFormData({ 
        ...editFormData, 
        isps: JSON.stringify(currentISPs), 
        isp: value || currentISPs.find(isp => isp.trim()) || '' 
      });
    }
  };

  const getEditISPsArray = (): string[] => {
    if (editFormData.isps) {
      try {
        return JSON.parse(editFormData.isps as string);
      } catch {
        return [editFormData.isp || ''];
      }
    }
    return [editFormData.isp || ''];
  };

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    
    if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchOffices();
  }, [session, status, router]);

  const fetchOffices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/offices');
      if (response.ok) {
        const data = await response.json();
        setOffices(data.offices || []);
        setError(null);
      } else {
        setError('Failed to fetch offices');
      }
    } catch (error) {
      console.error('Error fetching offices:', error);
      setError('Failed to fetch offices');
    } finally {
      setLoading(false);
    }
  };

  const fetchOfficeUsers = async (officeId: string) => {
    try {
      setLoadingUsers(true);
      const response = await fetch(`/api/offices/${officeId}/users`);
      if (response.ok) {
        const data = await response.json();
        setOfficeUsers(data.users || []);
      } else {
        setError('Failed to fetch office users');
      }
    } catch (error) {
      console.error('Error fetching office users:', error);
      setError('Failed to fetch office users');
    } finally {
      setLoadingUsers(false);
    }
  };
  const handleAddOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const filledISPs = formData.isps.filter(isp => isp.trim());
    
    if (!formData.unitOffice || !formData.location || filledISPs.length === 0 || !formData.userEmail || !formData.userName || !formData.userPassword) {
      setError('Please fill in all required fields and at least one ISP');
      return;
    }

    try {
      setSubmitting(true);
      
      const officeData = {
        ...formData,
        isp: filledISPs[0], // Set primary ISP to the first one
        isps: JSON.stringify(filledISPs), // Store all ISPs as JSON
      };

      const response = await fetch('/api/offices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(officeData),
      });

      if (response.ok) {
        await fetchOffices();
        setFormData({ 
          unitOffice: '', 
          subUnitOffice: '',
          location: '', 
          isp: '', 
          isps: [''],
          description: '',
          userEmail: '',
          userName: '',
          userPassword: ''
        });
        setShowAddForm(false);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create office');
      }
    } catch (error) {
      console.error('Error creating office:', error);
      setError('Failed to create office');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOffice = async (officeId: string) => {
    if (!confirm('Are you sure you want to delete this office? This will remove all users, speed tests, and schedules associated with this office.')) {
      return;
    }

    try {
      const response = await fetch(`/api/offices?id=${officeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchOffices();
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete office');
      }
    } catch (error) {
      console.error('Error deleting office:', error);
      setError('Failed to delete office');
    }
  };

  const handleDeleteUser = async (officeId: string, userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const response = await fetch(`/api/offices/${officeId}/users?userId=${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchOfficeUsers(officeId);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Failed to delete user');
    }
  };

  const handleViewUsers = (officeId: string) => {
    setViewingUsers(officeId);
    fetchOfficeUsers(officeId);
  };  const handleEditOffice = (office: Office) => {
    setEditingOffice(office.id);
    
    // Parse existing ISPs or use primary ISP as fallback
    let existingISPs: string[] = [];
    try {
      if (office.isps) {
        existingISPs = JSON.parse(office.isps);
      } else {
        existingISPs = [office.isp];
      }
    } catch {
      existingISPs = [office.isp];
    }
    
    setEditFormData({
      id: office.id,
      unitOffice: office.unitOffice,
      subUnitOffice: office.subUnitOffice || '',
      location: office.location,
      isp: office.isp,
      isps: JSON.stringify(existingISPs),
      description: office.description || ''
    });
    setError(null);
    setSuccessMessage(null);
  };  const handleUpdateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const filledISPs = getEditISPsArray().filter(isp => isp.trim());
    
    if (!editFormData.unitOffice || !editFormData.location || filledISPs.length === 0) {
      setError('Please fill in all required fields and at least one ISP');
      return;
    }    try {
      setSubmitting(true);
      
      const updateData = {
        ...editFormData,
        isp: filledISPs[0], // Set primary ISP to the first one
        isps: JSON.stringify(filledISPs), // Store all ISPs as JSON
      };

      const response = await fetch('/api/offices', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        await fetchOffices();
        setEditingOffice(null);
        setEditFormData({});
        setError(null);
        setSuccessMessage('Office updated successfully!');
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update office');
      }
    } catch (error) {
      console.error('Error updating office:', error);
      setError('Failed to update office');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingOffice(null);
    setEditFormData({});
    setError(null);
    setSuccessMessage(null);
  };

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!session || session?.user?.role !== 'ADMIN') {
    return null;
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading offices...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Office Management</h2>
              <p className="text-gray-600 mt-1">
                Manage offices and their network monitoring settings
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              disabled={editingOffice !== null}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Office
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-600">{successMessage}</p>
            </div>
          )}

          {/* Add Office Form */}
          {showAddForm && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Office</h3>
              <form onSubmit={handleAddOffice} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit Office *
                    </label>
                    <input
                      type="text"
                      value={formData.unitOffice}
                      onChange={(e) => setFormData({ ...formData, unitOffice: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter unit office name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sub-unit Office
                    </label>
                    <input
                      type="text"
                      value={formData.subUnitOffice}
                      onChange={(e) => setFormData({ ...formData, subUnitOffice: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter sub-unit office name (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location *
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="City, State/Province"
                      required
                    />
                  </div>                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ISP Providers *
                    </label>
                    <div className="space-y-2">
                      {formData.isps.map((isp, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={isp}
                            onChange={(e) => updateISPField(index, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={`Internet Service Provider ${index + 1}`}
                            required={index === 0}
                          />
                          {formData.isps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeISPField(index)}
                              className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md border border-red-300"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addISPField}
                        className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md border border-blue-300"
                      >
                        <Plus className="h-4 w-4" />
                        Add Another ISP
                      </button>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Optional description"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      User Email *
                    </label>
                    <input
                      type="email"
                      value={formData.userEmail}
                      onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="user@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      User Name *
                    </label>
                    <input
                      type="text"
                      value={formData.userName}
                      onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      User Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.userPassword}
                        onChange={(e) => setFormData({ ...formData, userPassword: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Office'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Offices Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {offices.map((office) => (
              <div key={office.id} className={`bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow ${
                editingOffice === office.id ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
              }`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Building className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {office.unitOffice}
                        {office.subUnitOffice && (
                          <span className="text-sm text-gray-600 ml-2">
                            - {office.subUnitOffice}
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <MapPin className="h-4 w-4 mr-1" />
                        {office.location}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button 
                      onClick={() => handleViewUsers(office.id)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="View Users"
                      disabled={editingOffice !== null}
                    >
                      <Users className="h-4 w-4" />
                    </button>                    <button 
                      onClick={() => handleEditOffice(office)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Edit Office"
                      disabled={editingOffice !== null}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteOffice(office.id)} 
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete Office"
                      disabled={editingOffice !== null}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {office.parentId && (
                    <div className="flex items-center text-xs text-gray-500">
                      <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                      Sub-unit of: {offices.find(o => o.id === office.parentId)?.unitOffice || 'Unknown'}
                    </div>
                  )}
                    <div className="flex items-start text-sm text-gray-600">
                    <Globe className="h-4 w-4 mr-2 mt-0.5" />
                    <div>
                      <span className="font-medium">ISPs:</span>
                      <div className="ml-1 flex flex-wrap gap-1 mt-1">
                        {(() => {
                          let displayISPs: string[] = [];
                          try {
                            if (office.isps) {
                              displayISPs = JSON.parse(office.isps);
                            } else {
                              displayISPs = [office.isp];
                            }
                          } catch {
                            displayISPs = [office.isp];
                          }
                          return displayISPs.map((isp, index) => (
                            <span 
                              key={index}
                              className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                            >
                              {isp}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>

                  {office.description && (
                    <p className="text-sm text-gray-600">{office.description}</p>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <div className="flex items-center text-sm text-gray-600">
                      <Activity className="h-4 w-4 mr-1" />
                      {office._count.speedTests} tests
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="h-4 w-4 mr-1" />
                      {office._count.users} users
                    </div>
                  </div>
                </div>

                {/* View Users Section */}
                <div className="mt-4">
                  <button
                    onClick={() => handleViewUsers(office.id)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    View Users
                  </button>
                </div>

                {/* Office Users List */}
                {viewingUsers === office.id && (
                  <div className="mt-4">
                    {loadingUsers ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4">
                        {officeUsers.length === 0 ? (
                          <p className="text-center text-gray-500 py-4">No users found for this office.</p>
                        ) : (
                          <div>
                            {officeUsers.map((user) => (
                              <div key={user.id} className="flex items-center justify-between py-2 border-b border-gray-200">
                                <div className="flex items-center">
                                  <span className="text-sm font-medium text-gray-900">{user.name}</span>
                                  <span className="text-xs text-gray-500 ml-2">{user.role}</span>
                                </div>
                                <button
                                  onClick={() => handleDeleteUser(office.id, user.id)}
                                  className="p-1 text-gray-400 hover:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {offices.length === 0 && (
            <div className="text-center py-12">
              <Building className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No offices</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new office.
              </p>
            </div>
          )}
        </div>
      </DashboardLayout>      {/* Edit Office Modal */}
      {editingOffice && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleCancelEdit}></div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-10">
              <form onSubmit={handleUpdateOffice}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Edit Office</h3>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit Office *
                      </label>
                      <input
                        type="text"
                        value={editFormData.unitOffice || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, unitOffice: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter unit office name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sub-unit Office
                      </label>
                      <input
                        type="text"
                        value={editFormData.subUnitOffice || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, subUnitOffice: e.target.value || undefined })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter sub-unit office name (optional)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Location *
                      </label>
                      <input
                        type="text"
                        value={editFormData.location || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="City, State/Province"
                        required
                      />
                    </div>                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ISP Providers *
                      </label>
                      <div className="space-y-2">
                        {getEditISPsArray().map((isp, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={isp}
                              onChange={(e) => updateEditISPField(index, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder={`Internet Service Provider ${index + 1}`}
                              required={index === 0}
                            />
                            {getEditISPsArray().length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeEditISPField(index)}
                                className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md border border-red-300"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addEditISPField}
                          className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md border border-blue-300"
                        >
                          <Plus className="h-4 w-4" />
                          Add Another ISP
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={editFormData.description || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Optional description"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {submitting ? 'Updating...' : 'Update Office'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Users Modal */}
      {viewingUsers && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setViewingUsers(null)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Office Users</h3>
                  <button
                    onClick={() => setViewingUsers(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                {loadingUsers ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    {officeUsers.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No users found for this office.</p>
                    ) : (
                      <div className="space-y-3">
                        {officeUsers.map((user) => (
                          <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-600">{user.email}</div>
                              <div className="text-xs text-gray-500">
                                Role: {user.role} | Created: {new Date(user.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteUser(viewingUsers, user.id)}
                              className="p-1 text-red-400 hover:text-red-600"
                              title="Delete User"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={() => setViewingUsers(null)}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
