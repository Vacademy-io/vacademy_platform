import { useState, useEffect } from 'react';
import { AdminMappings, StudentMapping, getMembers, addMember, terminateMembers, AddMemberRequest } from '@/services/sub-organization-learner-management';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Users, RefreshCw, X, Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/bootstrap.css";

interface SubOrgLearnersComponentProps {
  adminMappings: AdminMappings[];
  instituteDetails: any;
}

export function SubOrgLearnersComponent({ adminMappings, instituteDetails }: SubOrgLearnersComponentProps) {
  const [selectedPackageSession, setSelectedPackageSession] = useState<string>('');
  const [members, setMembers] = useState<StudentMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Form states for add member
  const [formData, setFormData] = useState({
    email: '',
    mobile_number: '',
    full_name: '',
    username: '',
    enrolled_date: format(new Date(), 'yyyy-MM-dd'),
    expiry_date: format(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'), // 1 year from now
    institute_enrollment_number: '',
    status: 'ACTIVE' as const,
    comma_separated_org_roles: ''
  });

  useEffect(() => {
    if (adminMappings.length > 0 && !selectedPackageSession) {
      setSelectedPackageSession(adminMappings[0].package_session_id);
    }
  }, [adminMappings, selectedPackageSession]);

  useEffect(() => {
    if (selectedPackageSession) {
      loadMembers();
    }
  }, [selectedPackageSession]);

  const loadMembers = async () => {
    if (!selectedPackageSession) return;

    setIsLoading(true);
    try {
      const selectedMapping = adminMappings.find(m => m.package_session_id === selectedPackageSession);
      if (!selectedMapping) return;

      const response = await getMembers(selectedPackageSession, selectedMapping.sub_org_id);
      setMembers(response.student_mappings || []);
    } catch (error) {
      console.error('Error loading members:', error);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedPackageSession) {
      toast.error('Please select a package session');
      return;
    }

    if (!formData.email || !formData.full_name || !formData.mobile_number) {
      toast.error('Email, full name, and mobile number are required');
      return;
    }

    if (!formData.comma_separated_org_roles) {
      toast.error('At least one organization role is required');
      return;
    }

    // Email validation
    if (!validateEmail(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Phone number validation (if provided)
    if (formData.mobile_number && !validatePhoneNumber(formData.mobile_number)) {
      toast.error('Please enter a valid phone number with country code (e.g., +1234567890)');
      return;
    }

    // Username validation (if provided)
    if (formData.username && !validateUsername(formData.username)) {
      toast.error('Username must contain only lowercase letters, numbers, and underscores (no capital letters)');
      return;
    }

    const selectedMapping = adminMappings.find(m => m.package_session_id === selectedPackageSession);
    if (!selectedMapping) {
      toast.error('Invalid package session selected');
      return;
    }

    try {
      const memberData: AddMemberRequest = {
        user: {
          email: formData.email,
          mobile_number: formData.mobile_number || undefined,
          full_name: formData.full_name,
          username: formData.username || undefined,
        },
        package_session_id: selectedPackageSession,
        sub_org_id: selectedMapping.sub_org_id,
        institute_id: selectedMapping.institute_id,
        enrolled_date: selectedMapping.enrolled_date ? String(selectedMapping.enrolled_date) : formData.enrolled_date,
        expiry_date: selectedMapping.expiry_date ? String(selectedMapping.expiry_date) : formData.expiry_date,
        institute_enrollment_number: formData.institute_enrollment_number || undefined,
        status: 'ACTIVE',
        comma_separated_org_roles: formData.comma_separated_org_roles,
      };

      await addMember(memberData);

      // Reset form
      setFormData({
        email: '',
        mobile_number: '',
        full_name: '',
        username: '',
        enrolled_date: format(new Date(), 'yyyy-MM-dd'),
        expiry_date: format(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        institute_enrollment_number: '',
        status: 'ACTIVE',
        comma_separated_org_roles: '',
      });

      setIsAddModalOpen(false);
      loadMembers(); // Refresh the list
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const handleTerminateMembers = async () => {
    if (selectedMembers.length === 0) {
      toast.error('Please select members to terminate');
      return;
    }

    if (!selectedPackageSession) {
      toast.error('Please select a package session');
      return;
    }

    const selectedMapping = adminMappings.find(m => m.package_session_id === selectedPackageSession);
    if (!selectedMapping) {
      toast.error('Invalid package session selected');
      return;
    }

    try {
      await terminateMembers({
        sub_org_id: selectedMapping.sub_org_id,
        institute_id: selectedMapping.institute_id,
        package_session_id: selectedPackageSession,
        user_ids: selectedMembers,
      });

      setSelectedMembers([]);
      loadMembers(); // Refresh the list
    } catch (error) {
      console.error('Error terminating members:', error);
    }
  };

  const handleSelectMember = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedMembers(prev => [...prev, userId]);
    } else {
      setSelectedMembers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMembers(members.map(m => m.user_id));
    } else {
      setSelectedMembers([]);
    }
  };
  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhoneNumber = (phone: string): boolean => {
    // Allow international format with + and various country codes
    // Accepts formats like: +1234567890, +44 123 456 7890, +91-9876543210, +1 (234) 567-8901
    // Basic validation: starts with +, followed by digits, spaces, dashes, dots, parentheses
    const cleanPhone = phone.replace(/[\s\-\.\(\)]/g, ''); // Remove spaces, dashes, dots, parentheses
    const phoneRegex = /^\+[1-9]\d{6,14}$/; // + followed by 7-15 digits (country code + number)
    return phoneRegex.test(cleanPhone);
  };

  const validateUsername = (username: string): boolean => {
    // Username must be lowercase only (no capital letters)
    return /^[a-z0-9_]+$/.test(username) && username === username.toLowerCase();
  };

  // Get package session name from package session ID
  const getPackageSessionName = (packageSessionId: string): string => {
    if (!instituteDetails?.batches_for_sessions) {
      return packageSessionId;
    }

    const batch = instituteDetails.batches_for_sessions.find(
      (b: any) => b.id === packageSessionId
    );

    if (!batch) {
      return packageSessionId;
    }

    const packageName = batch.package_dto?.package_name || '';
    let levelName = batch.level?.level_name || '';
    let sessionName = batch.session?.session_name || '';

    if (batch.level?.id === 'DEFAULT') levelName = '';
    if (batch.session?.id === 'DEFAULT') sessionName = '';

    // Format: "Package Name - Level Name - Session Name"
    const parts = [packageName, levelName, sessionName].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : packageSessionId;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'TERMINATED':
        return 'bg-red-100 text-red-800';
      case 'INVITED':
        return 'bg-blue-100 text-blue-800';
      case 'PENDING_FOR_APPROVAL':
        return 'bg-yellow-100 text-yellow-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{(adminMappings.find(m => m.package_session_id === selectedPackageSession) || adminMappings[0])?.sub_org_details?.institute_name || 'Sub Organization'}</h1>
          <p className="text-gray-600 mt-1">Manage learners for your {(adminMappings.find(m => m.package_session_id === selectedPackageSession) || adminMappings[0])?.sub_org_details?.institute_name || 'Sub Organization'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={loadMembers} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Learner
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6 z-[9999]">
              <DialogHeader>
                <DialogTitle>Add New Learner</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="learner@example.com"
                    className={formData.email && !validateEmail(formData.email) ? "border-red-500" : ""}
                  />
                  {formData.email && !validateEmail(formData.email) && (
                    <p className="text-xs text-red-600 mt-1">
                      Please enter a valid email address
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label htmlFor="mobile_number">Mobile Number * <span className="text-xs text-gray-500">(with country code)</span></Label>
                  <div className={formData.mobile_number && !validatePhoneNumber(formData.mobile_number) ? "phone-input-error" : ""}>
                    <PhoneInput
                      country={'au'}
                      value={formData.mobile_number}
                      onChange={(phone) => setFormData(prev => ({ ...prev, mobile_number: phone.startsWith('+') ? phone : `+${phone}` }))}
                      enableSearch={true}
                      placeholder="+1 234 567 8900"
                      inputClass="!w-full h-10 !rounded-md !border-input"
                      buttonClass="!rounded-l-md !border-input"
                      countryCodeEditable={false}
                      enableAreaCodes={true}
                      disableCountryGuess={false}
                      preferredCountries={["us", "gb", "in", "au"]}
                    />
                  </div>
                  {formData.mobile_number && !validatePhoneNumber(formData.mobile_number) && (
                    <p className="text-xs text-red-600 mt-1">
                      Please enter a valid phone number
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="username">Username <span className="text-xs text-gray-500">(lowercase only)</span></Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                    placeholder="johndoe"
                    className={formData.username && !validateUsername(formData.username) ? "border-red-500" : ""}
                  />
                  {formData.username && !validateUsername(formData.username) && (
                    <p className="text-xs text-red-600 mt-1">
                      Username must contain only lowercase letters, numbers, and underscores
                    </p>
                  )}
                </div>
                {/* <div>
                  <Label htmlFor="enrolled_date">Enrolled Date</Label>
                  <Input
                    id="enrolled_date"
                    type="date"
                    value={formData.enrolled_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, enrolled_date: e.target.value }))}
                  />
                </div> */}
                {/* <div>
                  <Label htmlFor="expiry_date">Expiry Date</Label>
                  <Input
                    id="expiry_date"
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                  />
                </div> */}
                <div>
                  <Label htmlFor="enrollment_number">Enrollment Number</Label>
                  <Input
                    id="enrollment_number"
                    value={formData.institute_enrollment_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, institute_enrollment_number: e.target.value }))}
                    placeholder="Enter the enrollment number"
                  />
                </div>
                {/* <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-40">
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="INVITED">Invited</SelectItem>
                      <SelectItem value="PENDING_FOR_APPROVAL">Pending Approval</SelectItem>
                    </SelectContent>
                  </Select>
                </div> */}
                <div>
                  <Label htmlFor="roles">Organization Roles *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="flex min-h-[40px] w-full flex-wrap items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
                        <div className="flex flex-wrap gap-1">
                          {formData.comma_separated_org_roles.split(',').filter(Boolean).length > 0 ? (
                            formData.comma_separated_org_roles.split(',').filter(Boolean).map((role) => (
                              <Badge key={role} variant="secondary" className="mr-1 mb-1">
                                {role}
                                <button
                                  className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const currentRoles = formData.comma_separated_org_roles.split(',').filter(Boolean);
                                      const newRoles = currentRoles.filter((r) => r !== role);
                                      setFormData(prev => ({ ...prev, comma_separated_org_roles: newRoles.join(',') }));
                                    }
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onClick={() => {
                                    const currentRoles = formData.comma_separated_org_roles.split(',').filter(Boolean);
                                    const newRoles = currentRoles.filter((r) => r !== role);
                                    setFormData(prev => ({ ...prev, comma_separated_org_roles: newRoles.join(',') }));
                                  }}
                                >
                                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </button>
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground">Select the Roles</span>
                          )}
                        </div>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandList>
                          <CommandEmpty>No role found.</CommandEmpty>
                          <CommandGroup>
                            {['LEARNER', 'ADMIN'].map((role) => {
                              const currentRoles = formData.comma_separated_org_roles.split(',').filter(Boolean);
                              const isSelected = currentRoles.includes(role);
                              return (
                                <CommandItem
                                  key={role}
                                  value={role}
                                  onSelect={(currentValue) => {
                                    const selectedRole = currentValue.toUpperCase(); // Command might lowercase values, ensure uppercase for consistency if needed, but 'value' prop handles matching too. standardizing on map value
                                    // Actually command passes the value as lowercase usually to onSelect. Stick to using the map 'role' variable.
                                    console.log(selectedRole); // using the variable to avoid lint error

                                    let newRoles;
                                    if (isSelected) {
                                      newRoles = currentRoles.filter((r) => r !== role);
                                    } else {
                                      newRoles = [...currentRoles, role];
                                    }
                                    setFormData(prev => ({ ...prev, comma_separated_org_roles: newRoles.join(',') }));
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      isSelected ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {role}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button onClick={handleAddMember} className="w-full sm:w-auto">
                    Add Learner
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Package Session Selector */}
      {adminMappings.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Package Session</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedPackageSession} onValueChange={setSelectedPackageSession}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a package session" />
              </SelectTrigger>
              <SelectContent>
                {adminMappings.map((mapping) => (
                  <SelectItem key={mapping.package_session_id} value={mapping.package_session_id}>
                    {getPackageSessionName(mapping.package_session_id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      ) : adminMappings.length === 1 && selectedPackageSession ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Package Session</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 font-medium">
              {getPackageSessionName(selectedPackageSession)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Members Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Learners ({members.length})
              </CardTitle>
              {selectedPackageSession && (
                <p className="text-sm text-gray-600 mt-1">
                  {getPackageSessionName(selectedPackageSession)}
                </p>
              )}
              {selectedMembers.length > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedMembers.length} learner{selectedMembers.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>
            {selectedMembers.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleTerminateMembers}>
                <Trash2 className="w-4 h-4 mr-2" />
                Terminate Selected ({selectedMembers.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              <span className="ml-3 text-gray-600">Loading learners...</span>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No learners found</h3>
              <p className="text-gray-600">Start by adding learners to this package session.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedMembers.length === members.length && members.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Enrollment Number</TableHead>
                    {/* <TableHead>Enrolled Date</TableHead> */}
                    {/* <TableHead>Expiry Date</TableHead> */}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedMembers.includes(member.user_id)}
                          onCheckedChange={(checked) => handleSelectMember(member.user_id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{member.user.full_name}</TableCell>
                      <TableCell>{member.user.email}</TableCell>
                      <TableCell>{member.user.mobile_number || '-'}</TableCell>
                      <TableCell>{member.institute_enrollment_number || '-'}</TableCell>
                      {/* <TableCell>
                        {member.enrolled_date ? format(new Date(member.enrolled_date), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        {member.expiry_date ? format(new Date(member.expiry_date), 'MMM dd, yyyy') : '-'}
                      </TableCell> */}
                      <TableCell>
                        <Badge className={getStatusColor(member.status)}>
                          {member.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
