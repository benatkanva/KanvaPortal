'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy,
  where,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  Plus,
  Settings,
  MoreVertical,
  GripVertical,
  X,
  Edit,
  Trash2,
  ChevronDown,
  DollarSign,
  Calendar,
  Building2,
  User,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Filter,
  Search
} from 'lucide-react';
import type { Pipeline, PipelineStage, PipelineDeal } from '@/lib/crm/types';

// Default Sales Pipeline stages
const DEFAULT_SALES_STAGES: PipelineStage[] = [
  { id: 'lead', name: 'Lead', order: 0, color: '#6B7280', probability: 10 },
  { id: 'qualified', name: 'Qualified', order: 1, color: '#3B82F6', probability: 25 },
  { id: 'proposal', name: 'Proposal', order: 2, color: '#8B5CF6', probability: 50 },
  { id: 'negotiation', name: 'Negotiation', order: 3, color: '#F59E0B', probability: 75 },
  { id: 'won', name: 'Won', order: 4, color: '#10B981', probability: 100 },
  { id: 'lost', name: 'Lost', order: 5, color: '#EF4444', probability: 0 },
];

export default function PipelinesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [editingDeal, setEditingDeal] = useState<PipelineDeal | null>(null);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'pipeline' | 'deal' | 'stage'; id: string } | null>(null);
  
  // Drag state
  const [draggedDeal, setDraggedDeal] = useState<PipelineDeal | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Form data
  const [pipelineForm, setPipelineForm] = useState({
    name: '',
    description: '',
    isShared: true,
  });

  const [dealForm, setDealForm] = useState({
    name: '',
    value: '',
    stageId: '',
    accountName: '',
    contactName: '',
    expectedCloseDate: '',
    notes: '',
    source: '',
  });

  const [stageForm, setStageForm] = useState({
    name: '',
    color: '#3B82F6',
    probability: 50,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    loadPipelines();
  }, [authLoading, user, router]);

  useEffect(() => {
    if (selectedPipeline) {
      loadDeals(selectedPipeline.id);
    }
  }, [selectedPipeline]);

  const loadPipelines = async () => {
    try {
      const pipelinesQuery = query(
        collection(db, 'pipelines'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(pipelinesQuery);
      const data: Pipeline[] = [];
      
      snapshot.forEach((doc) => {
        const docData = doc.data();
        data.push({
          id: doc.id,
          ...docData,
          createdAt: docData.createdAt?.toDate() || new Date(),
          updatedAt: docData.updatedAt?.toDate() || new Date(),
        } as Pipeline);
      });
      
      // If no pipelines exist, create default sales pipeline
      if (data.length === 0) {
        const defaultPipeline = await createDefaultPipeline();
        if (defaultPipeline) {
          data.push(defaultPipeline);
        }
      }
      
      setPipelines(data);
      
      // Select first pipeline or default
      const defaultPipeline = data.find(p => p.isDefault) || data[0];
      if (defaultPipeline) {
        setSelectedPipeline(defaultPipeline);
      }
    } catch (error) {
      console.error('Error loading pipelines:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultPipeline = async (): Promise<Pipeline | null> => {
    try {
      const pipelineData = {
        name: 'Sales Pipeline',
        description: 'Main sales pipeline for tracking deals',
        stages: DEFAULT_SALES_STAGES,
        isDefault: true,
        isShared: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user?.uid,
      };
      
      const docRef = await addDoc(collection(db, 'pipelines'), pipelineData);
      
      return {
        id: docRef.id,
        ...pipelineData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Pipeline;
    } catch (error) {
      console.error('Error creating default pipeline:', error);
      return null;
    }
  };

  const loadDeals = async (pipelineId: string) => {
    try {
      const dealsQuery = query(
        collection(db, 'pipeline_deals'),
        where('pipelineId', '==', pipelineId),
        orderBy('stageOrder', 'asc')
      );
      const snapshot = await getDocs(dealsQuery);
      const data: PipelineDeal[] = [];
      
      snapshot.forEach((doc) => {
        const docData = doc.data();
        data.push({
          id: doc.id,
          ...docData,
          createdAt: docData.createdAt?.toDate() || new Date(),
          updatedAt: docData.updatedAt?.toDate() || new Date(),
          expectedCloseDate: docData.expectedCloseDate?.toDate(),
          wonDate: docData.wonDate?.toDate(),
          lostDate: docData.lostDate?.toDate(),
        } as PipelineDeal);
      });
      
      setDeals(data);
    } catch (error) {
      console.error('Error loading deals:', error);
    }
  };

  // Pipeline CRUD
  const handleSavePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const pipelineData = {
        name: pipelineForm.name,
        description: pipelineForm.description || null,
        isShared: pipelineForm.isShared,
        updatedAt: Timestamp.now(),
      };

      if (editingPipeline) {
        await updateDoc(doc(db, 'pipelines', editingPipeline.id), pipelineData);
      } else {
        await addDoc(collection(db, 'pipelines'), {
          ...pipelineData,
          stages: DEFAULT_SALES_STAGES,
          isDefault: false,
          createdAt: Timestamp.now(),
          createdBy: user?.uid,
          ownerId: user?.uid,
        });
      }

      setShowPipelineModal(false);
      resetPipelineForm();
      loadPipelines();
    } catch (error) {
      console.error('Error saving pipeline:', error);
    }
  };

  const handleDeletePipeline = async (id: string) => {
    try {
      // Delete all deals in this pipeline first
      const dealsQuery = query(
        collection(db, 'pipeline_deals'),
        where('pipelineId', '==', id)
      );
      const snapshot = await getDocs(dealsQuery);
      const batch = writeBatch(db);
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      
      // Delete pipeline
      await deleteDoc(doc(db, 'pipelines', id));
      
      setShowDeleteConfirm(null);
      loadPipelines();
    } catch (error) {
      console.error('Error deleting pipeline:', error);
    }
  };

  // Deal CRUD
  const handleSaveDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPipeline) return;
    
    try {
      const dealData = {
        name: dealForm.name,
        value: dealForm.value ? parseFloat(dealForm.value) : null,
        stageId: dealForm.stageId || selectedPipeline.stages[0]?.id,
        accountName: dealForm.accountName || null,
        contactName: dealForm.contactName || null,
        expectedCloseDate: dealForm.expectedCloseDate ? Timestamp.fromDate(new Date(dealForm.expectedCloseDate)) : null,
        notes: dealForm.notes || null,
        source: dealForm.source || null,
        pipelineId: selectedPipeline.id,
        status: 'open' as const,
        updatedAt: Timestamp.now(),
      };

      if (editingDeal) {
        await updateDoc(doc(db, 'pipeline_deals', editingDeal.id), dealData);
      } else {
        // Get max order for this stage
        const stageDeals = deals.filter(d => d.stageId === dealData.stageId);
        const maxOrder = stageDeals.length > 0 ? Math.max(...stageDeals.map(d => d.stageOrder || 0)) : 0;
        
        await addDoc(collection(db, 'pipeline_deals'), {
          ...dealData,
          stageOrder: maxOrder + 1,
          createdAt: Timestamp.now(),
          createdBy: user?.uid,
        });
      }

      setShowDealModal(false);
      resetDealForm();
      loadDeals(selectedPipeline.id);
    } catch (error) {
      console.error('Error saving deal:', error);
    }
  };

  const handleDeleteDeal = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'pipeline_deals', id));
      setShowDeleteConfirm(null);
      if (selectedPipeline) {
        loadDeals(selectedPipeline.id);
      }
    } catch (error) {
      console.error('Error deleting deal:', error);
    }
  };

  const handleMoveDeal = async (dealId: string, newStageId: string) => {
    if (!selectedPipeline) return;
    
    try {
      const deal = deals.find(d => d.id === dealId);
      if (!deal || deal.stageId === newStageId) return;
      
      // Get max order for new stage
      const stageDeals = deals.filter(d => d.stageId === newStageId);
      const maxOrder = stageDeals.length > 0 ? Math.max(...stageDeals.map(d => d.stageOrder || 0)) : 0;
      
      // Check if this is won or lost stage
      const stage = selectedPipeline.stages.find(s => s.id === newStageId);
      const isWon = stage?.name.toLowerCase() === 'won';
      const isLost = stage?.name.toLowerCase() === 'lost';
      
      const updateData: any = {
        stageId: newStageId,
        stageOrder: maxOrder + 1,
        updatedAt: Timestamp.now(),
      };
      
      if (isWon) {
        updateData.status = 'won';
        updateData.wonDate = Timestamp.now();
      } else if (isLost) {
        updateData.status = 'lost';
        updateData.lostDate = Timestamp.now();
      } else {
        updateData.status = 'open';
      }
      
      await updateDoc(doc(db, 'pipeline_deals', dealId), updateData);
      loadDeals(selectedPipeline.id);
    } catch (error) {
      console.error('Error moving deal:', error);
    }
  };

  // Stage CRUD
  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPipeline) return;
    
    try {
      let updatedStages = [...selectedPipeline.stages];
      
      if (editingStage) {
        updatedStages = updatedStages.map(s => 
          s.id === editingStage.id 
            ? { ...s, name: stageForm.name, color: stageForm.color, probability: stageForm.probability }
            : s
        );
      } else {
        const newStage: PipelineStage = {
          id: `stage_${Date.now()}`,
          name: stageForm.name,
          color: stageForm.color,
          probability: stageForm.probability,
          order: updatedStages.length,
        };
        updatedStages.push(newStage);
      }
      
      await updateDoc(doc(db, 'pipelines', selectedPipeline.id), {
        stages: updatedStages,
        updatedAt: Timestamp.now(),
      });
      
      setShowStageModal(false);
      resetStageForm();
      loadPipelines();
    } catch (error) {
      console.error('Error saving stage:', error);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!selectedPipeline) return;
    
    try {
      // Move all deals in this stage to first stage
      const firstStage = selectedPipeline.stages.find(s => s.id !== stageId);
      if (firstStage) {
        const stageDeals = deals.filter(d => d.stageId === stageId);
        for (const deal of stageDeals) {
          await updateDoc(doc(db, 'pipeline_deals', deal.id), {
            stageId: firstStage.id,
            updatedAt: Timestamp.now(),
          });
        }
      }
      
      // Remove stage from pipeline
      const updatedStages = selectedPipeline.stages
        .filter(s => s.id !== stageId)
        .map((s, i) => ({ ...s, order: i }));
      
      await updateDoc(doc(db, 'pipelines', selectedPipeline.id), {
        stages: updatedStages,
        updatedAt: Timestamp.now(),
      });
      
      setShowDeleteConfirm(null);
      loadPipelines();
    } catch (error) {
      console.error('Error deleting stage:', error);
    }
  };

  // Reset forms
  const resetPipelineForm = () => {
    setEditingPipeline(null);
    setPipelineForm({ name: '', description: '', isShared: true });
  };

  const resetDealForm = () => {
    setEditingDeal(null);
    setDealForm({
      name: '',
      value: '',
      stageId: '',
      accountName: '',
      contactName: '',
      expectedCloseDate: '',
      notes: '',
      source: '',
    });
  };

  const resetStageForm = () => {
    setEditingStage(null);
    setStageForm({ name: '', color: '#3B82F6', probability: 50 });
  };

  // Drag handlers
  const handleDragStart = (deal: PipelineDeal) => {
    setDraggedDeal(deal);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (draggedDeal) {
      handleMoveDeal(draggedDeal.id, stageId);
      setDraggedDeal(null);
    }
  };

  // Edit handlers
  const openEditPipeline = (pipeline: Pipeline) => {
    setEditingPipeline(pipeline);
    setPipelineForm({
      name: pipeline.name,
      description: pipeline.description || '',
      isShared: pipeline.isShared ?? true,
    });
    setShowPipelineModal(true);
  };

  const openEditDeal = (deal: PipelineDeal) => {
    setEditingDeal(deal);
    setDealForm({
      name: deal.name,
      value: deal.value?.toString() || '',
      stageId: deal.stageId,
      accountName: deal.accountName || '',
      contactName: deal.contactName || '',
      expectedCloseDate: deal.expectedCloseDate 
        ? new Date(deal.expectedCloseDate).toISOString().split('T')[0] 
        : '',
      notes: deal.notes || '',
      source: deal.source || '',
    });
    setShowDealModal(true);
  };

  const openEditStage = (stage: PipelineStage) => {
    setEditingStage(stage);
    setStageForm({
      name: stage.name,
      color: stage.color,
      probability: stage.probability || 50,
    });
    setShowStageModal(true);
  };

  // Filter deals by search
  const filteredDeals = searchTerm
    ? deals.filter(d => 
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.accountName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.contactName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : deals;

  // Calculate stage totals
  const getStageStats = (stageId: string) => {
    const stageDeals = filteredDeals.filter(d => d.stageId === stageId);
    const total = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    return { count: stageDeals.length, total };
  };

  // Calculate pipeline totals
  const getPipelineStats = () => {
    const openDeals = filteredDeals.filter(d => d.status === 'open');
    const wonDeals = filteredDeals.filter(d => d.status === 'won');
    const lostDeals = filteredDeals.filter(d => d.status === 'lost');
    
    return {
      open: { count: openDeals.length, total: openDeals.reduce((sum, d) => sum + (d.value || 0), 0) },
      won: { count: wonDeals.length, total: wonDeals.reduce((sum, d) => sum + (d.value || 0), 0) },
      lost: { count: lostDeals.length, total: lostDeals.reduce((sum, d) => sum + (d.value || 0), 0) },
    };
  };

  const stats = getPipelineStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-[#93D500] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
            <p className="text-gray-500 text-sm">Manage your sales pipeline and deals</p>
          </div>
          
          {/* Pipeline Selector */}
          <div className="relative">
            <select
              value={selectedPipeline?.id || ''}
              onChange={(e) => {
                const pipeline = pipelines.find(p => p.id === e.target.value);
                setSelectedPipeline(pipeline || null);
              }}
              className="pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
            >
              {pipelines.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search deals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
            />
          </div>
          
          <button
            onClick={() => { resetPipelineForm(); setShowPipelineModal(true); }}
            className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            New Pipeline
          </button>
          
          <button
            onClick={() => { resetDealForm(); setShowDealModal(true); }}
            className="px-4 py-2 bg-[#93D500] hover:bg-[#84c000] text-black font-medium rounded-lg transition-colors text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Deal
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-6 mb-4 p-3 bg-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Open</p>
            <p className="font-semibold text-gray-900">{stats.open.count} deals · ${stats.open.total.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Won</p>
            <p className="font-semibold text-gray-900">{stats.won.count} deals · ${stats.won.total.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Lost</p>
            <p className="font-semibold text-gray-900">{stats.lost.count} deals · ${stats.lost.total.toLocaleString()}</p>
          </div>
        </div>
        
        {selectedPipeline && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => openEditPipeline(selectedPipeline)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit Pipeline"
            >
              <Settings className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={() => { resetStageForm(); setShowStageModal(true); }}
              className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Stage
            </button>
          </div>
        )}
      </div>

      {/* Kanban Board */}
      {selectedPipeline && (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 h-full pb-4" style={{ minWidth: `${selectedPipeline.stages.length * 300}px` }}>
            {selectedPipeline.stages
              .sort((a, b) => a.order - b.order)
              .map((stage) => {
                const stageStats = getStageStats(stage.id);
                const stageDeals = filteredDeals.filter(d => d.stageId === stage.id);
                const isDropTarget = dragOverStage === stage.id;
                
                return (
                  <div
                    key={stage.id}
                    className={`w-72 flex-shrink-0 flex flex-col bg-gray-50 rounded-xl border-2 transition-colors ${
                      isDropTarget ? 'border-[#93D500] bg-[#93D500]/5' : 'border-transparent'
                    }`}
                    onDragOver={(e) => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, stage.id)}
                  >
                    {/* Stage Header */}
                    <div className="p-3 border-b border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                          <span className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-medium text-gray-600">
                            {stageStats.count}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditStage(stage)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                          >
                            <Edit className="w-3 h-3 text-gray-500" />
                          </button>
                          {selectedPipeline.stages.length > 1 && (
                            <button
                              onClick={() => setShowDeleteConfirm({ type: 'stage', id: stage.id })}
                              className="p-1 hover:bg-red-100 rounded transition-colors"
                            >
                              <Trash2 className="w-3 h-3 text-gray-500" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        ${stageStats.total.toLocaleString()}
                      </p>
                    </div>
                    
                    {/* Stage Content */}
                    <div className="flex-1 p-2 overflow-y-auto space-y-2">
                      {stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={() => handleDragStart(deal)}
                          onDragEnd={() => setDraggedDeal(null)}
                          className={`p-3 bg-white rounded-lg border border-gray-200 cursor-grab hover:shadow-md transition-shadow ${
                            draggedDeal?.id === deal.id ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{deal.name}</h4>
                            <button
                              onClick={() => openEditDeal(deal)}
                              className="p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                            >
                              <MoreVertical className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                          
                          {deal.value && (
                            <div className="flex items-center gap-1 text-sm text-gray-700 mb-2">
                              <DollarSign className="w-3.5 h-3.5" />
                              <span className="font-medium">${deal.value.toLocaleString()}</span>
                            </div>
                          )}
                          
                          <div className="space-y-1 text-xs text-gray-500">
                            {deal.accountName && (
                              <div className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                <span className="truncate">{deal.accountName}</span>
                              </div>
                            )}
                            {deal.contactName && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span className="truncate">{deal.contactName}</span>
                              </div>
                            )}
                            {deal.expectedCloseDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(deal.expectedCloseDate).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                          
                          {deal.status !== 'open' && (
                            <div className={`mt-2 px-2 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1 ${
                              deal.status === 'won' 
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {deal.status === 'won' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {deal.status === 'won' ? 'Won' : 'Lost'}
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {stageDeals.length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          Drop deals here
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Pipeline Modal */}
      {showPipelineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPipeline ? 'Edit Pipeline' : 'New Pipeline'}
              </h2>
              <button onClick={() => { setShowPipelineModal(false); resetPipelineForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSavePipeline} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={pipelineForm.name}
                  onChange={(e) => setPipelineForm({ ...pipelineForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={pipelineForm.description}
                  onChange={(e) => setPipelineForm({ ...pipelineForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pipelineForm.isShared}
                  onChange={(e) => setPipelineForm({ ...pipelineForm, isShared: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-[#93D500] focus:ring-[#93D500]"
                />
                <span className="text-sm text-gray-700">Share with team</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowPipelineModal(false); resetPipelineForm(); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#93D500] hover:bg-[#84c000] text-black font-medium rounded-lg"
                >
                  {editingPipeline ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deal Modal */}
      {showDealModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingDeal ? 'Edit Deal' : 'New Deal'}
              </h2>
              <button onClick={() => { setShowDealModal(false); resetDealForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDeal} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deal Name *</label>
                <input
                  type="text"
                  required
                  value={dealForm.name}
                  onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={dealForm.value}
                    onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                  <select
                    value={dealForm.stageId}
                    onChange={(e) => setDealForm({ ...dealForm, stageId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
                  >
                    {selectedPipeline?.stages.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                  <input
                    type="text"
                    value={dealForm.accountName}
                    onChange={(e) => setDealForm({ ...dealForm, accountName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                  <input
                    type="text"
                    value={dealForm.contactName}
                    onChange={(e) => setDealForm({ ...dealForm, contactName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Close</label>
                  <input
                    type="date"
                    value={dealForm.expectedCloseDate}
                    onChange={(e) => setDealForm({ ...dealForm, expectedCloseDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <input
                    type="text"
                    value={dealForm.source}
                    onChange={(e) => setDealForm({ ...dealForm, source: e.target.value })}
                    placeholder="e.g., Trade Show, Referral"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={dealForm.notes}
                  onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
                />
              </div>
              
              {editingDeal && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm({ type: 'deal', id: editingDeal.id })}
                  className="w-full px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Deal
                </button>
              )}
              
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowDealModal(false); resetDealForm(); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#93D500] hover:bg-[#84c000] text-black font-medium rounded-lg"
                >
                  {editingDeal ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stage Modal */}
      {showStageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingStage ? 'Edit Stage' : 'New Stage'}
              </h2>
              <button onClick={() => { setShowStageModal(false); resetStageForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveStage} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={stageForm.name}
                  onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={stageForm.color}
                      onChange={(e) => setStageForm({ ...stageForm, color: e.target.value })}
                      className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={stageForm.color}
                      onChange={(e) => setStageForm({ ...stageForm, color: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Probability (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={stageForm.probability}
                    onChange={(e) => setStageForm({ ...stageForm, probability: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93D500]/50"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowStageModal(false); resetStageForm(); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#93D500] hover:bg-[#84c000] text-black font-medium rounded-lg"
                >
                  {editingStage ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete {showDeleteConfirm.type === 'pipeline' ? 'Pipeline' : showDeleteConfirm.type === 'deal' ? 'Deal' : 'Stage'}?
            </h3>
            <p className="text-gray-600 mb-6">
              {showDeleteConfirm.type === 'pipeline' 
                ? 'This will delete all deals in this pipeline.'
                : showDeleteConfirm.type === 'stage'
                ? 'Deals in this stage will be moved to the first stage.'
                : 'This action cannot be undone.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showDeleteConfirm.type === 'pipeline') {
                    handleDeletePipeline(showDeleteConfirm.id);
                  } else if (showDeleteConfirm.type === 'deal') {
                    handleDeleteDeal(showDeleteConfirm.id);
                  } else if (showDeleteConfirm.type === 'stage') {
                    handleDeleteStage(showDeleteConfirm.id);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
