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
  section?: string;
  isp: string; // Primary ISP (for backward compatibility)
  isps?: string; // JSON string of all ISPs
  sectionISPs?: string; // JSON string of section-specific ISPs
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
  userPassword: string;  sectionISPs?: { [section: string]: string[] }; // Advanced: Section-specific ISPs
}

// Unit and SubUnit mapping
const UNIT_SUBUNIT_MAPPING = {
  'RMFB': [
    'RMFB HQ',
    'TSC',
    '401st',
    '402nd',
    '403rd',
    '404th',
    '405th',
  ],
  'Palawan PPO': [
    'Puerto Prinsesa CHQ',
    'Puerto Prinsesa CMFC',
    'Police Station 1 Mendoza',
    'Police Station 2 Irawan',
    'Police Station 3',
    'Police Station 4',
    'Police Station 5',
    'Palawan PHQ',
    '1st PMFC',
    '2nd PMFC',
    'Aborlan MPS',
    'Agutaya MPS',
    'Araceli MPS',
    'Balabac MPS',
    'Bataraza MPS',
    'Brooke\'s Point MPS',
    'Busuanga MPS',
    'Cagayancillo MPS',
    'Coron MPS',
    'Culion MPS',
    'Cuyo MPS',
    'Dumaran MPS',
    'El Nido MPS',
    'Española MPS',
    'Kalayaan MPS',
    'Linapacan MPS',
    'Magsaysay MPS',
    'Narra MPS',
    'Quezon MPS',
    'Rizal MPS',
    'Roxas MPS',
    'San Vicente MPS',
    'Taytay MPS',
  ],
  'Romblon PPO': [
    'Romblon PHQ',
    'Romblon PMFC',
    'Alcantara MPS',
    'Banton MPS',
    'Cajidiocan MPS',
    'Calatrava MPS',
    'Concepcion MPS',
    'Corcuera MPS',
    'Ferrol MPS',
    'Looc MPS',
    'Magdiwang MPS',
    'Odiongan MPS',
    'Romblon MPS',
    'San Agustin MPS',
    'San Andres MPS',
    'San Fernando MPS',
    'San Jose MPS',
    'Santa Fe MPS',
    'Santa Maria MPS',
  ],
  'Marinduque PPO': [
    '1st PMFP',
    '2nd PMFP',
    'Boac MPS',
    'Buenavista MPS',
    'Gasan MPS',
    'Mogpog MPS',
    'Santa Cruz MPS',
    'Torrijos MPS',
  ],
  'Occidental Mindoro PPO': [
    '1st PMFC',
    '2nd PMFC',
    'Abra de Ilog MPS',
    'Calintaan MPS',
    'Looc MPS',
    'Lubang MPS',
    'Magsaysay MPS',
    'Mamburao MPS',
    'Paluan MPS',
    'Rizal MPS',
    'Sablayan MPS',
    'San Jose MPS',
    'Santa Cruz MPS',
  ],
  'Oriental Mindoro PPO': [
    '1st PMFC',
    '2nd PMFC',
    'PTPU',
    'Calapan CPS',
    'Baco MPS',
    'Bansud MPS',
    'Bongabong MPS',
    'Bulalacao MPS',
    'Gloria MPS',
    'Mansalay MPS',
    'Naujan MPS',
    'Pinamalayan MPS',
    'Pola MPS',
    'Puerto Galera MPS',
    'Roxas MPS',
    'San Teodoro MPS',
    'Socorro MPS',
    'Victoria MPS',
  ],
  'RHQ': [
    'ORD',
    'ORDA',
    'ODRDO',
    'OCRS',
    'RPRMD',
    'RID',
    'ROMD',
    'RLRDD',
    'RCADD',
    'RCD',
    'RIDMD',
    'RICTMD',
    'RLDDD',
    'RPSMD',
    'RHSU',
    'ORESPO',
    'RHRAO',
    'RPSMU',
    'RPIO',
  ],
} as const;

type UnitType = keyof typeof UNIT_SUBUNIT_MAPPING;

interface OfficeUser {
  id: string;
  email: string;
  name: string;
  role: string;  createdAt: string;
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
    userPassword: '',
    sectionISPs: {} // Advanced section-specific ISPs
  });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [viewingUsers, setViewingUsers] = useState<string | null>(null);
  const [officeUsers, setOfficeUsers] = useState<OfficeUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);  const [editingOffice, setEditingOffice] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Office>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);  const [sectionList, setSectionList] = useState<string[]>(['']); // List of sections
  const [showEditAdvancedSettings, setShowEditAdvancedSettings] = useState(false);
  const [editSectionList, setEditSectionList] = useState<string[]>(['']); // List of sections for edit form

  // Unit/SubUnit state management
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [availableSubUnits, setAvailableSubUnits] = useState<string[]>([]);
  const [editSelectedUnit, setEditSelectedUnit] = useState<string>('');
  const [editAvailableSubUnits, setEditAvailableSubUnits] = useState<string[]>([]);

  // Helper function to handle unit selection
  const handleUnitChange = (unit: string) => {
    setSelectedUnit(unit);
    setFormData({ ...formData, unitOffice: unit, subUnitOffice: '' });
      if (unit && UNIT_SUBUNIT_MAPPING[unit as UnitType]) {
      setAvailableSubUnits([...UNIT_SUBUNIT_MAPPING[unit as UnitType]]);
    } else {
      setAvailableSubUnits([]);
    }
  };

  // Helper function to handle subunit selection
  const handleSubUnitChange = (subUnit: string) => {
    setFormData({ ...formData, subUnitOffice: subUnit });
  };

  // Helper function to handle edit unit selection
  const handleEditUnitChange = (unit: string) => {
    setEditSelectedUnit(unit);
    setEditFormData({ ...editFormData, unitOffice: unit, subUnitOffice: '' });
      if (unit && UNIT_SUBUNIT_MAPPING[unit as UnitType]) {
      setEditAvailableSubUnits([...UNIT_SUBUNIT_MAPPING[unit as UnitType]]);
    } else {
      setEditAvailableSubUnits([]);
    }
  };

  // Helper function to handle edit subunit selection
  const handleEditSubUnitChange = (subUnit: string) => {
    setEditFormData({ ...editFormData, subUnitOffice: subUnit });
  };

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
        const parsed = JSON.parse(editFormData.isps as string);
        return Array.isArray(parsed) ? parsed : [editFormData.isp || ''];
      } catch {
        return [editFormData.isp || ''];
      }
    }
    return [editFormData.isp || ''];
  };

  // Helper functions for managing sections and advanced settings
  const addSectionField = () => {
    setSectionList([...sectionList, '']);
  };

  const removeSectionField = (index: number) => {
    if (sectionList.length > 1) {
      const newSections = sectionList.filter((_, i) => i !== index);
      setSectionList(newSections);
      // Also remove from sectionISPs if it exists
      const updatedSectionISPs = { ...formData.sectionISPs };
      const sectionToRemove = sectionList[index];
      if (sectionToRemove && updatedSectionISPs && updatedSectionISPs[sectionToRemove]) {
        delete updatedSectionISPs[sectionToRemove];
        setFormData({ ...formData, sectionISPs: updatedSectionISPs });
      }
    }
  };

  const updateSection = (index: number, value: string) => {
    const newSections = [...sectionList];
    const oldValue = newSections[index];
    newSections[index] = value;
    setSectionList(newSections);
    
    // Update sectionISPs mapping if section name changed
    if (oldValue && formData.sectionISPs && formData.sectionISPs[oldValue]) {
      const updatedSectionISPs = { ...formData.sectionISPs };
      updatedSectionISPs[value] = updatedSectionISPs[oldValue];
      delete updatedSectionISPs[oldValue];
      setFormData({ ...formData, sectionISPs: updatedSectionISPs });
    }
  };  const updateSectionISPs = (section: string, isps: string[]) => {
    const updatedSectionISPs = { ...formData.sectionISPs || {} };
    if (isps.length > 0) {
      updatedSectionISPs[section] = isps; // Keep all ISPs including empty ones for editing
    } else {
      delete updatedSectionISPs[section];
    }
    setFormData({ ...formData, sectionISPs: updatedSectionISPs });
  };

  // Helper function to validate section ISPs
  const validateSectionISPs = (sectionISPs: { [section: string]: string[] }): boolean => {
    return Object.values(sectionISPs).every(isps => 
      isps.every(isp => isp.trim().length > 0)
    );
  };

  // Helper function to get total ISP count for a section
  const getSectionISPCount = (section: string): number => {
    return (formData.sectionISPs?.[section] || []).filter(isp => isp.trim()).length;
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
      });      if (response.ok) {
        await fetchOffices();
        resetFormData();
        setShowAddForm(false);
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
      existingISPs = [office.isp];    }

    // Parse section-specific ISPs if available
    let existingSectionISPs: { [section: string]: string[] } = {};
    let sections: string[] = [''];
    try {
      if (office.sectionISPs) {
        existingSectionISPs = JSON.parse(office.sectionISPs);
        sections = Object.keys(existingSectionISPs);
        if (sections.length === 0) sections = [''];
      }
    } catch {
      existingSectionISPs = {};
      sections = [''];
    }    setEditFormData({
      id: office.id,
      unitOffice: office.unitOffice,
      subUnitOffice: office.subUnitOffice || '',
      location: office.location,
      isp: office.isp,
      isps: JSON.stringify(existingISPs),
      description: office.description || '',
      sectionISPs: JSON.stringify(existingSectionISPs)
    });
    
    // Set unit/subunit dropdowns for edit form
    setEditSelectedUnit(office.unitOffice);
    if (office.unitOffice && UNIT_SUBUNIT_MAPPING[office.unitOffice as UnitType]) {
      setEditAvailableSubUnits([...UNIT_SUBUNIT_MAPPING[office.unitOffice as UnitType]]);
    } else {
      setEditAvailableSubUnits([]);
    }
    
    setEditSectionList(sections);
    setShowEditAdvancedSettings(Object.keys(existingSectionISPs).length > 0);
    setError(null);
    setSuccessMessage(null);
  };  const handleUpdateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const filledISPs = getEditISPsArray().filter(isp => isp.trim());
    
    if (!editFormData.unitOffice || !editFormData.location || filledISPs.length === 0) {
      setError('Please fill in all required fields and at least one ISP');
      return;
    }try {
      setSubmitting(true);      const updateData = {
        ...editFormData,
        isp: filledISPs[0], // Set primary ISP to the first one
        isps: JSON.stringify(filledISPs), // Store all ISPs as JSON
        sectionISPs: editFormData.sectionISPs || '{}', // Include section-specific ISPs
      };

      const response = await fetch('/api/offices', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });      if (response.ok) {
        await fetchOffices();
        resetEditFormData();
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
    resetEditFormData();
  };
  // Helper function to reset form data
  const resetFormData = () => {
    setFormData({
      unitOffice: '',
      subUnitOffice: '',
      location: '',
      isp: '',
      isps: [''],
      description: '',
      userEmail: '',
      userName: '',
      userPassword: '',
      sectionISPs: {}
    });
    setSectionList(['']);
    setShowAdvancedSettings(false);
    setSelectedUnit('');
    setAvailableSubUnits([]);
    setError(null);
    setSuccessMessage(null);
  };  // Helper function to reset edit form data
  const resetEditFormData = () => {
    setEditFormData({});
    setEditSectionList(['']);
    setShowEditAdvancedSettings(false);
    setEditSelectedUnit('');
    setEditAvailableSubUnits([]);
    setEditingOffice(null);
    setError(null);
    setSuccessMessage(null);
  };

  // Helper functions for managing edit form sections and advanced settings
  const addEditSectionField = () => {
    setEditSectionList([...editSectionList, '']);
  };

  const removeEditSectionField = (index: number) => {
    if (editSectionList.length > 1) {
      const newSections = editSectionList.filter((_, i) => i !== index);
      setEditSectionList(newSections);
      // Also remove from sectionISPs if it exists
      const sectionToRemove = editSectionList[index];
      if (sectionToRemove && editFormData.sectionISPs) {
        try {
          const currentSectionISPs = JSON.parse(editFormData.sectionISPs);
          if (currentSectionISPs[sectionToRemove]) {
            delete currentSectionISPs[sectionToRemove];
            setEditFormData({ ...editFormData, sectionISPs: JSON.stringify(currentSectionISPs) });
          }
        } catch (e) {
          console.error('Error removing section from edit form:', e);
        }
      }
    }
  };

  const updateEditSection = (index: number, value: string) => {
    const newSections = [...editSectionList];
    const oldValue = newSections[index];
    newSections[index] = value;
    setEditSectionList(newSections);
    
    // Update sectionISPs mapping if section name changed
    if (oldValue && editFormData.sectionISPs) {
      try {
        const currentSectionISPs = JSON.parse(editFormData.sectionISPs);
        if (currentSectionISPs[oldValue]) {
          currentSectionISPs[value] = currentSectionISPs[oldValue];
          delete currentSectionISPs[oldValue];
          setEditFormData({ ...editFormData, sectionISPs: JSON.stringify(currentSectionISPs) });
        }
      } catch (e) {
        console.error('Error updating section in edit form:', e);
      }
    }
  };

  const updateEditSectionISPs = (section: string, isps: string[]) => {
    try {
      const currentSectionISPs = editFormData.sectionISPs ? JSON.parse(editFormData.sectionISPs) : {};
      if (isps.length > 0) {
        currentSectionISPs[section] = isps;
      } else {
        delete currentSectionISPs[section];
      }
      setEditFormData({ ...editFormData, sectionISPs: JSON.stringify(currentSectionISPs) });
    } catch (e) {
      console.error('Error updating section ISPs in edit form:', e);
    }
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
            </div>            <button
              onClick={() => {
                if (!showAddForm) {
                  // Reset form data when opening the form
                  resetFormData();
                }
                setShowAddForm(!showAddForm);
              }}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit Office *
                    </label>                    <select
                      value={selectedUnit}
                      onChange={(e) => handleUnitChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select Office Unit</option>
                      {Object.keys(UNIT_SUBUNIT_MAPPING).map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sub-unit Office
                    </label>
                    <select
                      value={formData.subUnitOffice}
                      onChange={(e) => handleSubUnitChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!selectedUnit || availableSubUnits.length === 0}
                    >
                      <option value="">Select Sub-unit Office</option>
                      {availableSubUnits.map((subUnit) => (
                        <option key={subUnit} value={subUnit}>
                          {subUnit}
                        </option>
                      ))}
                    </select>
                    {selectedUnit && availableSubUnits.length === 0 && (
                      <p className="text-sm text-gray-500 mt-1">No sub-units available for selected unit</p>
                    )}
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
                      placeholder="City, State/Province"                      required
                    />
                  </div>
                  
                  {/* Advanced Settings Toggle */}
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      <span>{showAdvancedSettings ? '🔽' : '▶️'}</span>
                      Advanced Settings - Section-specific ISPs
                    </button>
                  </div>

                  {/* Advanced Settings Panel */}
                  {showAdvancedSettings && (
                    <div className="md:col-span-2 border border-gray-200 rounded-lg p-4 bg-gray-50">                      <h4 className="text-sm font-medium text-gray-700 mb-3">
                        Section-specific ISP Configuration
                      </h4>
                      <p className="text-xs text-gray-600 mb-4">
                        Configure different ISPs for specific sections. Each section can have multiple ISPs. 
                        If no sections are configured, the office will use the general ISP settings above.
                      </p>
                      
                      <div className="space-y-3">
                        {sectionList.map((section, sectionIndex) => (
                          <div key={sectionIndex} className="border border-gray-300 rounded-md p-3 bg-white">
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="text"
                                value={section}
                                onChange={(e) => updateSection(sectionIndex, e.target.value)}
                                placeholder="Section name"
                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              />
                              {sectionList.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeSectionField(sectionIndex)}
                                  className="p-1 text-red-600 hover:text-red-800"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                              <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-600">ISPs for this section:</label>
                                <span className="text-xs text-green-600">
                                  {(formData.sectionISPs?.[section] || ['']).filter(isp => isp.trim()).length} ISP(s) configured
                                </span>
                              </div>
                              {(formData.sectionISPs?.[section] || ['']).map((sectionISP, ispIndex) => (
                                <div key={ispIndex} className="flex gap-1 items-center">
                                  <span className="text-xs text-gray-400 w-6">{ispIndex + 1}.</span>
                                  <input
                                    type="text"
                                    value={sectionISP}
                                    onChange={(e) => {
                                      const currentISPs = formData.sectionISPs?.[section] || [''];
                                      const newISPs = [...currentISPs];
                                      newISPs[ispIndex] = e.target.value;
                                      updateSectionISPs(section, newISPs);
                                    }}
                                    placeholder={`ISP ${ispIndex + 1} name (e.g. GLOBE, SMART, PLDT)`}
                                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                  />                                  <button
                                    type="button"                                    onClick={(e) => {
                                      e.preventDefault();
                                      const currentISPs = formData.sectionISPs?.[section] || [''];
                                      const newISPs = [...currentISPs, ''];
                                      updateSectionISPs(section, newISPs);
                                    }}
                                    className="px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
                                    title="Add another ISP"
                                  >
                                    + ISP
                                  </button>
                                  {(formData.sectionISPs?.[section] || ['']).length > 1 && (                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        const currentISPs = formData.sectionISPs?.[section] || [''];
                                        const newISPs = currentISPs.filter((_, i) => i !== ispIndex);
                                        updateSectionISPs(section, newISPs);
                                      }}
                                      className="px-2 py-1 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50"
                                      title="Remove this ISP"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                              
                              {/* Quick add common ISPs */}
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="flex flex-wrap gap-1">
                                  <span className="text-xs text-gray-500 mr-2">Quick add:</span>
                                  {['GLOBE', 'SMART', 'PLDT', 'CONVERGE', 'SKY'].map((commonISP) => (
                                    <button
                                      key={commonISP}
                                      type="button"                                      onClick={(e) => {
                                        e.preventDefault();
                                        const currentISPs = formData.sectionISPs?.[section] || [''];
                                        // Check if ISP already exists
                                        if (!currentISPs.includes(commonISP)) {
                                          const newISPs = currentISPs.filter(isp => isp.trim()); // Remove empty entries
                                          newISPs.push(commonISP);
                                          updateSectionISPs(section, newISPs);
                                        }
                                      }}
                                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                                      disabled={(formData.sectionISPs?.[section] || []).includes(commonISP)}
                                    >
                                      {commonISP}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        <button
                          type="button"
                          onClick={addSectionField}
                          className="w-full py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600"
                        >
                          + Add Another Section
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="md:col-span-2">
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
                <div className="flex justify-end space-x-3">                  <button
                    type="button"
                    onClick={() => {
                      // Reset form data when canceling
                      resetFormData();
                      setShowAddForm(false);
                    }}
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
                      </h3>                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <MapPin className="h-4 w-4 mr-1" />
                        {office.location}
                      </div>                      {office.section && (
                        <div className="text-xs text-gray-500 mt-1">
                          📋 {office.section}
                        </div>
                      )}                        {/* Display ISP configuration summary */}
                      {(() => {
                        try {
                          // Count general ISPs
                          let generalISPCount = 0;
                          if (office.isps) {
                            const generalISPs = JSON.parse(office.isps);
                            if (Array.isArray(generalISPs)) {
                              generalISPCount = generalISPs.filter(isp => isp && isp.trim()).length;
                            }
                          } else if (office.isp) {
                            generalISPCount = 1;
                          }
                            // Count section-specific ISPs
                          let sectionISPCount = 0;
                          let totalSections = 0;
                          const sectionISPs = office.sectionISPs ? JSON.parse(office.sectionISPs) : null;
                          if (sectionISPs && Object.keys(sectionISPs).length > 0) {
                            totalSections = Object.keys(sectionISPs).length;
                            sectionISPCount = Object.values(sectionISPs)
                              .flat()
                              .filter((isp: any) => isp && typeof isp === 'string' && isp.trim()).length;
                          }
                          
                          const totalISPs = generalISPCount + sectionISPCount;
                          
                          if (totalSections > 0) {
                            return (
                              <div className="text-xs text-green-600 mt-1">
                                🔧 Advanced ISP Settings: {totalSections} section(s), {totalISPs} total ISPs
                              </div>
                            );
                          } else if (generalISPCount > 0) {
                            return (
                              <div className="text-xs text-gray-500 mt-1">
                                🌐 {generalISPCount} ISP{generalISPCount > 1 ? 's' : ''} configured
                              </div>
                            );
                          }
                        } catch (error) {
                          // Ignore JSON parse errors
                        }
                        return null;
                      })()}
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
                  )}                  <div className="flex items-start text-sm text-gray-600">
                    <Globe className="h-4 w-4 mr-2 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-medium">ISPs:</span>
                        {(() => {
                        let displayISPs: string[] = [];
                        let sectionISPs: { [key: string]: string[] } = {};
                        
                        try {
                          if (office.isps) {
                            const parsed = JSON.parse(office.isps);
                            displayISPs = Array.isArray(parsed) ? parsed : [office.isp].filter(Boolean);
                          } else {
                            displayISPs = office.isp ? [office.isp] : [];
                          }
                          
                          if (office.sectionISPs) {
                            const parsedSections = JSON.parse(office.sectionISPs);
                            sectionISPs = typeof parsedSections === 'object' && parsedSections ? parsedSections : {};
                          }
                        } catch (error) {
                          console.warn('Failed to parse office ISPs:', error);
                          displayISPs = office.isp ? [office.isp] : [];
                        }
                        
                        // Ensure displayISPs is always an array
                        if (!Array.isArray(displayISPs)) {
                          displayISPs = office.isp ? [office.isp] : ['Unknown ISP'];
                        }
                        
                        return (
                          <div className="mt-1">
                            {/* General ISPs */}
                            <div className="flex flex-wrap gap-1 mb-2">
                              <span className="text-xs text-gray-500">General:</span>
                              {displayISPs.map((isp, index) => (
                                <span 
                                  key={index}
                                  className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                >
                                  {isp}
                                </span>
                              ))}
                            </div>
                              {/* Section-specific ISPs */}
                            {Object.keys(sectionISPs).length > 0 && (
                              <div className="space-y-1">
                                <span className="text-xs text-gray-500">Section-specific ISPs:</span>
                                {Object.entries(sectionISPs).map(([section, isps]) => (
                                  <div key={section} className="text-xs">
                                    <span className="text-gray-600 font-medium">{section}:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {isps.map((isp, index) => (
                                        <span 
                                          key={index}
                                          className="inline-block px-1.5 py-0.5 bg-green-100 text-green-800 text-xs rounded"
                                        >
                                          {isp}
                                        </span>
                                      ))}
                                      <span className="text-xs text-gray-400">({isps.length} ISP{isps.length > 1 ? 's' : ''})</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
                    <div>                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit Office *
                      </label>                      <select
                        value={editSelectedUnit}
                        onChange={(e) => handleEditUnitChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select Office Unit</option>
                        {Object.keys(UNIT_SUBUNIT_MAPPING).map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </div>                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sub-unit Office
                      </label>
                      <select
                        value={editFormData.subUnitOffice || ''}
                        onChange={(e) => handleEditSubUnitChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={!editSelectedUnit || editAvailableSubUnits.length === 0}
                      >
                        <option value="">Select Sub-unit Office</option>
                        {editAvailableSubUnits.map((subUnit) => (
                          <option key={subUnit} value={subUnit}>
                            {subUnit}
                          </option>
                        ))}
                      </select>
                      {editSelectedUnit && editAvailableSubUnits.length === 0 && (
                        <p className="text-sm text-gray-500 mt-1">No sub-units available for selected unit</p>
                      )}
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
                      />                    </div>
                    
                    {/* Advanced Settings Toggle */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowEditAdvancedSettings(!showEditAdvancedSettings)}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        <span>{showEditAdvancedSettings ? '🔽' : '▶️'}</span>
                        Advanced Settings - Section-specific ISPs
                      </button>
                    </div>

                    {/* Advanced Settings Panel */}
                    {showEditAdvancedSettings && (
                      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">                        <h4 className="text-sm font-medium text-gray-700 mb-3">
                          Section-specific ISP Configuration
                        </h4>
                        <p className="text-xs text-gray-600 mb-4">
                          Configure different ISPs for specific sections. Each section can have multiple ISPs. 
                          If no sections are configured, the office will use the general ISP settings below.
                        </p>
                        
                        <div className="space-y-3">
                          {editSectionList.map((section, sectionIndex) => (
                            <div key={sectionIndex} className="border border-gray-300 rounded-md p-3 bg-white">
                              <div className="flex items-center gap-2 mb-2">
                                <input
                                  type="text"
                                  value={section}
                                  onChange={(e) => updateEditSection(sectionIndex, e.target.value)}
                                  placeholder="Section name"
                                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                />
                                {editSectionList.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeEditSectionField(sectionIndex)}
                                    className="p-1 text-red-600 hover:text-red-800"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                                <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs text-gray-600">ISPs for this section:</label>
                                  <span className="text-xs text-green-600">
                                    {(() => {
                                      try {
                                        const sectionISPs = editFormData.sectionISPs ? JSON.parse(editFormData.sectionISPs) : {};
                                        return (sectionISPs[section] || ['']).filter((isp: string) => isp.trim()).length;
                                      } catch {
                                        return 0;
                                      }
                                    })()} ISP(s) configured
                                  </span>
                                </div>
                                {(() => {
                                  try {
                                    const sectionISPs = editFormData.sectionISPs ? JSON.parse(editFormData.sectionISPs) : {};
                                    return (sectionISPs[section] || ['']).map((sectionISP: string, ispIndex: number) => (
                                      <div key={ispIndex} className="flex gap-1 items-center">
                                        <span className="text-xs text-gray-400 w-6">{ispIndex + 1}.</span>
                                        <input
                                          type="text"
                                          value={sectionISP}
                                          onChange={(e) => {
                                            const currentISPs = sectionISPs[section] || [''];
                                            const newISPs = [...currentISPs];
                                            newISPs[ispIndex] = e.target.value;
                                            updateEditSectionISPs(section, newISPs);
                                          }}
                                          placeholder={`ISP ${ispIndex + 1} name (e.g. GLOBE, SMART, PLDT)`}
                                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                        />                                        <button
                                          type="button"                                          onClick={(e) => {
                                            e.preventDefault();
                                            const currentISPs = sectionISPs[section] || [''];
                                            const newISPs = [...currentISPs, ''];
                                            updateEditSectionISPs(section, newISPs);
                                          }}
                                          className="px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
                                          title="Add another ISP"
                                        >
                                          + ISP
                                        </button>
                                        {(sectionISPs[section] || ['']).length > 1 && (                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              const currentISPs = sectionISPs[section] || [''];
                                              const newISPs = currentISPs.filter((_: string, i: number) => i !== ispIndex);
                                              updateEditSectionISPs(section, newISPs);
                                            }}
                                            className="px-2 py-1 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50"
                                            title="Remove this ISP"
                                          >
                                            ×
                                          </button>
                                        )}
                                      </div>
                                    ));
                                  } catch {
                                    return (
                                      <div className="flex gap-1 items-center">
                                        <span className="text-xs text-gray-400 w-6">1.</span>
                                        <input
                                          type="text"
                                          value=""
                                          onChange={(e) => updateEditSectionISPs(section, [e.target.value])}
                                          placeholder="ISP 1 name (e.g. GLOBE, SMART, PLDT)"
                                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                        />
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            updateEditSectionISPs(section, ['', '']);
                                          }}
                                          className="px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
                                        >
                                          + ISP
                                        </button>
                                      </div>
                                    );
                                  }
                                })()}
                                
                                {/* Quick add common ISPs */}
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                  <div className="flex flex-wrap gap-1">
                                    <span className="text-xs text-gray-500 mr-2">Quick add:</span>
                                    {['GLOBE', 'SMART', 'PLDT', 'CONVERGE', 'SKY'].map((commonISP) => (
                                      <button
                                        key={commonISP}
                                        type="button"                                        onClick={(e) => {
                                          e.preventDefault();
                                          try {
                                            const sectionISPs = editFormData.sectionISPs ? JSON.parse(editFormData.sectionISPs) : {};
                                            const currentISPs = sectionISPs[section] || [''];
                                            // Check if ISP already exists
                                            if (!currentISPs.includes(commonISP)) {
                                              const newISPs = currentISPs.filter((isp: string) => isp.trim()); // Remove empty entries
                                              newISPs.push(commonISP);
                                              updateEditSectionISPs(section, newISPs);
                                            }
                                          } catch (e) {
                                            updateEditSectionISPs(section, [commonISP]);
                                          }
                                        }}
                                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                                        disabled={(() => {
                                          try {
                                            const sectionISPs = editFormData.sectionISPs ? JSON.parse(editFormData.sectionISPs) : {};
                                            return (sectionISPs[section] || []).includes(commonISP);
                                          } catch {
                                            return false;
                                          }
                                        })()}
                                      >
                                        {commonISP}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          <button
                            type="button"
                            onClick={addEditSectionField}
                            className="w-full py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600"
                          >
                            + Add Another Section
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="md:col-span-2">
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
