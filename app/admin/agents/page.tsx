'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Button } from '@/modules/core/components/ui/button';
import { Input } from '@/modules/core/components/ui/input';
import { Label } from '@/modules/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/modules/core/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/modules/core/components/ui/dialog';
import { Badge } from '@/modules/core/components/ui/badge';
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert';
import { useToast } from '@/modules/core/hooks/use-toast';
import { 
  Users, 
  Plus, 
  Search, 
  Filter,
  Edit, 
  Trash2, 
  Key,
  UserPlus,
  Mail,
  Phone,
  Calendar,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';

// Add debug hook to check auth state
import { useEffect } from 'react';

interface AgentFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'agent' | 'supervisor' | 'admin';
  isAiAgent: boolean;
}

interface AgentEditData {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'agent' | 'supervisor' | 'admin';
  isActive: boolean;
  isAiAgent: boolean;
  twilioWorkerSid?: string;
}

export default function AgentManagementPage() {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentEditData | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Add debug state
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Get current user info for debugging
  const { data: currentUser } = api.auth.me.useQuery();

  // Debug effect
  useEffect(() => {
    if (currentUser) {
      setDebugInfo({
        isLoggedIn: !!currentUser,
        role: currentUser.agent?.role,
        isAdmin: currentUser.agent?.role === 'admin',
        permissions: currentUser.permissions
      });
    }
  }, [currentUser]);

  // Debug modal state
  useEffect(() => {
    if (isCreateModalOpen) {
      console.log('🔴 CREATE MODAL IS NOW OPEN!');
      console.log('Modal state:', isCreateModalOpen);
    }
  }, [isCreateModalOpen]);

  // Form state for create
  const [createFormData, setCreateFormData] = useState<AgentFormData>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'agent',
    isAiAgent: false
  });

  // Form state for edit
  const [editFormData, setEditFormData] = useState<AgentEditData>({
    id: 0,
    email: '',
    firstName: '',
    lastName: '',
    role: 'agent',
    isActive: true,
    isAiAgent: false,
    twilioWorkerSid: ''
  });

  // Get agents with filters
  const { data: agentsData, isLoading, refetch } = api.auth.getAllAgents.useQuery({
    page: currentPage,
    limit: 20,
    ...(roleFilter !== 'all' && { role: roleFilter as any }),
    // Only show active agents unless specifically filtering for inactive ones
    isActive: activeFilter === 'false' ? false : activeFilter === 'all' ? undefined : true,
    ...(searchTerm && { search: searchTerm })
  });

  // Mutations
  const createAgentMutation = api.auth.createAgent.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent created successfully",
      });
      setIsCreateModalOpen(false);
      setCreateFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'agent',
        isAiAgent: false
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateAgentMutation = api.auth.updateAgent.useMutation({
    onSuccess: () => {
      toast({
        title: "Success", 
        description: "Agent updated successfully",
      });
      setIsEditModalOpen(false);
      setSelectedAgent(null);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteAgentMutation = api.auth.deleteAgent.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent deleted successfully",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error", 
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const resetPasswordMutation = api.auth.resetAgentPassword.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset successfully",
      });
      setIsResetPasswordModalOpen(false);
      setNewPassword('');
      setSelectedAgent(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    if (!createFormData.email || !createFormData.password || !createFormData.firstName || !createFormData.lastName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (createFormData.password.length < 8) {
      toast({
        title: "Validation Error", 
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    if (!/\S+@\S+\.\S+/.test(createFormData.email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    createAgentMutation.mutate(createFormData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { id, ...updateData } = editFormData;
    updateAgentMutation.mutate({ id, ...updateData });
  };

  const handleEdit = (agent: any) => {
    setSelectedAgent(agent);
    setEditFormData({
      id: agent.id,
      email: agent.email,
      firstName: agent.firstName,
      lastName: agent.lastName,
      role: agent.role,
      isActive: agent.isActive,
      isAiAgent: agent.isAiAgent,
      twilioWorkerSid: agent.twilioWorkerSid || ''
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = (agent: any) => {
    const confirmMessage = `⚠️ PERMANENTLY DELETE AGENT?\n\nAgent: ${agent.firstName} ${agent.lastName}\nEmail: ${agent.email}\nRole: ${agent.role}\n\nThis action CANNOT be undone!\n\n🔴 TO CONFIRM DELETION:\nType the word DELETE (in capital letters) below:`;
    
    const userInput = prompt(confirmMessage);
    if (userInput === 'DELETE') {
      deleteAgentMutation.mutate({ id: agent.id });
    } else if (userInput !== null) {
      toast({
        title: "Deletion Cancelled",
        description: "Agent was not deleted. You must type 'DELETE' exactly to confirm.",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = (agent: any) => {
    setSelectedAgent(agent);
    setNewPassword('');
    setIsResetPasswordModalOpen(true);
  };

  const submitPasswordReset = () => {
    if (!selectedAgent || !newPassword || newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }
    resetPasswordMutation.mutate({ 
      id: selectedAgent.id, 
      newPassword 
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'supervisor': return 'bg-blue-100 text-blue-800';
      case 'agent': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Debug Information */}
      {debugInfo && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">Debug Information</h3>
            <pre className="text-sm text-yellow-700">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Agent Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage system agents, roles, and permissions
          </p>
        </div>
        
        {/* Add Agent Buttons - with fallback options */}
        <div className="flex gap-2">
          {/* Simple Manual Button that directly opens modal */}
          <Button
            onClick={() => {
              console.log('Add Agent button clicked - opening modal');
              setIsCreateModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Agent
          </Button>
          
          {/* Fallback Manual Button for Testing */}
          <Button
            variant="outline"
            onClick={() => {
              console.log('Fallback button clicked - manually opening modal');
              setIsCreateModalOpen(true);
            }}
          >
            Manual Open
          </Button>
          
          {/* Simple Test Button */}
          <Button
            variant="destructive"
            onClick={() => {
              alert("Basic button click works!");
            }}
          >
            Test Click
          </Button>
        </div>
        
        {debugInfo?.isAdmin ? null : (
          <div className="text-sm text-red-600">
            Admin access required to add agents
          </div>
        )}
      </div>

      {/* Simple Custom Modal - No Radix UI complexity */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
            onClick={() => setIsCreateModalOpen(false)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-lg shadow-2xl border-4 border-red-500 p-6 max-w-md w-full mx-4 z-[10000]">
            {/* Close Button */}
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl font-bold"
            >
              ×
            </button>
            
            {/* Modal Header */}
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">Create New Agent</h2>
            </div>
            
            {/* Modal Body - Form */}
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={createFormData.firstName}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={createFormData.lastName}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={createFormData.password}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, password: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>
              
              <div>
                <Label htmlFor="role">Role</Label>
                <Select 
                  value={createFormData.role} 
                  onValueChange={(value) => setCreateFormData(prev => ({ ...prev, role: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isAiAgent"
                  checked={createFormData.isAiAgent}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, isAiAgent: e.target.checked }))}
                />
                <Label htmlFor="isAiAgent">AI Agent</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createAgentMutation.isPending}>
                  {createAgentMutation.isPending ? 'Creating...' : 'Create Agent'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search agents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Agents ({agentsData?.total || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : agentsData?.agents.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No agents found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Agent</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agentsData?.agents.map((agent) => (
                    <tr key={agent.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">
                            {agent.firstName} {agent.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{agent.email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getRoleBadgeColor(agent.role)}>
                          {agent.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(agent.isActive)}
                          <span className={agent.isActive ? 'text-green-700' : 'text-red-700'}>
                            {agent.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={agent.isAiAgent ? 'default' : 'outline'}>
                          {agent.isAiAgent ? 'AI Agent' : 'Human'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-900">
                        {new Date(agent.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(agent)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetPassword(agent)}
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(agent)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {agentsData && agentsData.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, agentsData.total)} of {agentsData.total} agents
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={currentPage === agentsData.totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Agent Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editFirstName">First Name</Label>
                <Input
                  id="editFirstName"
                  value={editFormData.firstName}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="editLastName">Last Name</Label>
                <Input
                  id="editLastName"
                  value={editFormData.lastName}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="editRole">Role</Label>
              <Select 
                value={editFormData.role} 
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, role: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="editTwilioWorkerSid">Twilio Worker SID (Optional)</Label>
              <Input
                id="editTwilioWorkerSid"
                value={editFormData.twilioWorkerSid}
                onChange={(e) => setEditFormData(prev => ({ ...prev, twilioWorkerSid: e.target.value }))}
                placeholder="Enter Twilio Worker SID"
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editFormData.isActive}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                />
                <Label htmlFor="editIsActive">Active</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editIsAiAgent"
                  checked={editFormData.isAiAgent}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, isAiAgent: e.target.checked }))}
                />
                <Label htmlFor="editIsAiAgent">AI Agent</Label>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateAgentMutation.isPending}>
                {updateAgentMutation.isPending ? 'Updating...' : 'Update Agent'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={isResetPasswordModalOpen} onOpenChange={setIsResetPasswordModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Resetting password for: {selectedAgent?.firstName} {selectedAgent?.lastName}
              </AlertDescription>
            </Alert>
            
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                placeholder="Enter new password (min 8 characters)"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsResetPasswordModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={submitPasswordReset}
                disabled={resetPasswordMutation.isPending || newPassword.length < 8}
              >
                {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 