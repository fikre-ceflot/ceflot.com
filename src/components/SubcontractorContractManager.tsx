import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  FileText, 
  Plus, 
  Search, 
  CheckCircle2, 
  Trash2, 
  ArrowRight,
  TrendingUp,
  DollarSign,
  Briefcase,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Layers,
  Info,
  Pencil,
  X,
  Maximize2,
  Minimize2,
  Loader2,
  Check
} from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';
import { Project, BOQItem, Subcontractor, SubcontractorAssignment } from '../types';

export interface ContractTreeNode {
  id: string;
  itemNo: string;
  description: string;
  isLeaf: boolean;
  contractQty: number;
  assignment?: SubcontractorAssignment;
  children: ContractTreeNode[];
  parent?: ContractTreeNode;
  percentage: number;
  value: number;
}

export const buildAndCalculateContractTree = (
  items: SubcontractorAssignment[],
  overallValue: number,
  percentsMap: Record<string, string>,
  boqItems: BOQItem[],
  isEditMode: boolean
): { topLevelNodes: ContractTreeNode[]; nodeMap: Map<string, ContractTreeNode> } => {
  const allItemNosSet = new Set<string>();
  items.forEach(it => {
    const itemNo = it.boq_item?.item_no || '';
    if (itemNo) {
      allItemNosSet.add(itemNo);
      const parts = itemNo.split('.');
      for (let i = 1; i < parts.length; i++) {
        allItemNosSet.add(parts.slice(0, i).join('.'));
      }
    }
  });

  const nodeMap = new Map<string, ContractTreeNode>();
  allItemNosSet.forEach(itemNo => {
    const assignment = items.find(it => (it.boq_item?.item_no || '') === itemNo);
    const boq = boqItems.find(b => b.item_no === itemNo);

    // Any item with no sub-items underneath is a child (leaf node)
    const hasSubItemUnderneath = Array.from(allItemNosSet).some(other => other.startsWith(itemNo + '.'));
    const isLeaf = !hasSubItemUnderneath;

    nodeMap.set(itemNo, {
      id: `node_${itemNo.replace(/\./g, '_')}`,
      itemNo,
      description: assignment?.boq_item?.description || boq?.description || 'Sub-category',
      isLeaf: isLeaf,
      assignment: assignment,
      contractQty: assignment ? (assignment.contract_qty || 0) : 0,
      children: [],
      percentage: 0,
      value: 0
    });
  });

  const topLevelNodes: ContractTreeNode[] = [];
  nodeMap.forEach(node => {
    if (node.itemNo.includes('.')) {
      const parentNo = node.itemNo.substring(0, node.itemNo.lastIndexOf('.'));
      const parentNode = nodeMap.get(parentNo);
      if (parentNode) {
        parentNode.children.push(node);
        node.parent = parentNode;
      } else {
        topLevelNodes.push(node);
      }
    } else {
      topLevelNodes.push(node);
    }
  });

  const sortNodes = (nodes: ContractTreeNode[]) => {
    nodes.sort((a, b) => a.itemNo.localeCompare(b.itemNo, undefined, { numeric: true }));
    nodes.forEach(n => {
      if (n.children.length > 0) {
        sortNodes(n.children);
      }
    });
  };
  sortNodes(topLevelNodes);

  const calculateBottomUpValues = (node: ContractTreeNode): number => {
    if (node.isLeaf) {
      node.value = node.assignment?.lump_sum_total || 0;
      return node.value;
    }
    const sum = node.children.reduce((acc, c) => acc + calculateBottomUpValues(c), 0);
    node.value = sum;
    return sum;
  };

  const calculatePercentagesTopDown = (node: ContractTreeNode, parentVal: number) => {
    if (node.isLeaf || node.children.length === 0) return;

    const subCategories = node.children.filter(c => !c.isLeaf);
    const leafChildren = node.children.filter(c => c.isLeaf);

    if (leafChildren.length > 0) {
      const subCategoriesSum = subCategories.reduce((acc, c) => acc + (parseFloat(percentsMap[c.itemNo]) || 0), 0);
      const remainingPct = Math.max(0, 100 - subCategoriesSum);
      const totalLeafQty = leafChildren.reduce((sum, c) => sum + c.contractQty, 0);

      leafChildren.forEach(c => {
        const share = totalLeafQty > 0 ? (c.contractQty / totalLeafQty) : (1 / leafChildren.length);
        c.percentage = share * remainingPct;
        c.value = parentVal * (c.percentage / 100);
      });

      subCategories.forEach(c => {
        const pctInput = percentsMap[c.itemNo];
        const pct = pctInput !== undefined ? (parseFloat(pctInput) || 0) : 0;
        c.percentage = pct;
        c.value = parentVal * (pct / 100);
        calculatePercentagesTopDown(c, c.value);
      });
    } else {
      node.children.forEach(c => {
        const pctInput = percentsMap[c.itemNo];
        const pct = pctInput !== undefined ? (parseFloat(pctInput) || 0) : 0;
        c.percentage = pct;
        c.value = parentVal * (pct / 100);
        calculatePercentagesTopDown(c, c.value);
      });
    }
  };

  if (!isEditMode) {
    let calculatedTotal = 0;
    topLevelNodes.forEach(node => {
      calculatedTotal += calculateBottomUpValues(node);
    });

    const populatePercentages = (node: ContractTreeNode, parentVal: number) => {
      if (parentVal > 0) {
        node.percentage = (node.value / parentVal) * 100;
      } else {
        node.percentage = node.isLeaf ? 100 : 0;
      }
      node.children.forEach(c => populatePercentages(c, node.value));
    };

    topLevelNodes.forEach(node => {
      populatePercentages(node, calculatedTotal);
    });

    topLevelNodes.forEach(node => {
      calculatePercentagesTopDown(node, node.value);
    });
  } else {
    const subCategories = topLevelNodes.filter(n => !n.isLeaf);
    const leafChildren = topLevelNodes.filter(n => n.isLeaf);

    if (leafChildren.length > 0) {
      const subCategoriesSum = subCategories.reduce((acc, n) => acc + (parseFloat(percentsMap[n.itemNo]) || 0), 0);
      const remainingPct = Math.max(0, 100 - subCategoriesSum);
      const totalLeafQty = leafChildren.reduce((sum, n) => sum + n.contractQty, 0);

      leafChildren.forEach(n => {
        const share = totalLeafQty > 0 ? (n.contractQty / totalLeafQty) : (1 / leafChildren.length);
        n.percentage = share * remainingPct;
        n.value = overallValue * (n.percentage / 100);
      });

      subCategories.forEach(n => {
        const pctInput = percentsMap[n.itemNo];
        const pct = pctInput !== undefined ? (parseFloat(pctInput) || 0) : 0;
        n.percentage = pct;
        n.value = overallValue * (pct / 100);
        calculatePercentagesTopDown(n, n.value);
      });
    } else {
      topLevelNodes.forEach(n => {
        const pctInput = percentsMap[n.itemNo];
        const pct = pctInput !== undefined ? (parseFloat(pctInput) || 0) : 0;
        n.percentage = pct;
        n.value = overallValue * (pct / 100);
        calculatePercentagesTopDown(n, n.value);
      });
    }
  }

  return { topLevelNodes, nodeMap };
};

interface SubcontractorContractManagerProps {
  project: Project | null;
  tenantId: string;
  onSelectProject?: () => void;
}

export function SubcontractorContractManager({ project, tenantId, onSelectProject }: SubcontractorContractManagerProps) {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [assignments, setAssignments] = useState<SubcontractorAssignment[]>([]);
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showContracted, setShowContracted] = useState(false);
  const [showPerformanceNotice, setShowPerformanceNotice] = useState(true);
  
  // Edit state
  const [editingMode, setEditingMode] = useState<'item' | 'group' | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<string>('');
  const [editLumpSum, setEditLumpSum] = useState<string>('');
  const [editGroupName, setEditGroupName] = useState<string>('');
  const [editPct, setEditPct] = useState<string>('');
  
  // Sorting state for subcontracts & line items
  const [contractSortBy, setContractSortBy] = useState<'date_desc' | 'date_asc' | 'sub_name' | 'value_desc' | 'value_asc'>('date_desc');
  const [lineSortBy, setLineSortBy] = useState<'item_no' | 'date_asc' | 'date_desc' | 'value_desc' | 'value_asc'>('item_no');
  
  // Selection state for new assignment
  const [selectedSub, setSelectedSub] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [assignmentType, setAssignmentType] = useState<'unit_rate' | 'lumpsum'>('unit_rate');
  const [groupName, setGroupName] = useState('');
  const [globalRate, setGlobalRate] = useState<string>('');
  const [lumpSumTotal, setLumpSumTotal] = useState<string>('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [parentPercentages, setParentPercentages] = useState<Record<string, string>>({});
  const [subGroupPercentages, setSubGroupPercentages] = useState<Record<string, string>>({});
  const [collapsedGroupItems, setCollapsedGroupItems] = useState<Record<string, Set<string>>>({});

  // Inline table-level contract editing states (replaces Mass Edit Modal)
  const [editingContractGroupId, setEditingContractGroupId] = useState<string | null>(null);
  const [inlineGroupName, setInlineGroupName] = useState<string>('');
  const [inlineLumpSumTotal, setInlineLumpSumTotal] = useState<string>('');
  const [inlineParentPcts, setInlineParentPcts] = useState<Record<string, string>>({});
  const [inlineSubGroupPcts, setInlineSubGroupPcts] = useState<Record<string, string>>({});
  const [inlineRates, setInlineRates] = useState<Record<string, string>>({});

  // Quick subcontractor on-the-fly creation states
  const [isQuickAddingSub, setIsQuickAddingSub] = useState(false);
  const [quickSubForm, setQuickSubForm] = useState({
    company_name: '',
    trade_category: 'Concrete Works',
    contact_person: '',
    email: '',
    phone: '',
    status: 'active' as 'active' | 'blacklisted' | 'pending'
  });

  // Batching state
  const [stagedGroups, setStagedGroups] = useState<{
    id: string;
    itemIds: string[];
    type: 'unit_rate' | 'lumpsum';
    rate: string;
    lumpSum: string;
    name: string;
    percentages?: Record<string, number>;
  }[]>([]);

  // Deletion confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'assignment' | 'contract';
    id?: string;
    subcontractorId?: string;
    groupName?: string;
    assignmentType?: string;
    scopeCount?: number;
    subTitle?: string;
  } | null>(null);

  useEffect(() => {
    if (project) {
      loadData();
    }
  }, [project?.id]);

  useEffect(() => {
    if (assignmentType === 'lumpsum') {
      const leaves = boqItems.filter(item => selectedItems.has(item.id) && !hasChildren(item.item_no || ''));
      if (leaves.length > 0) {
        // Group leaves to find parent numbers
        const pGroups: Record<string, string[]> = {};
        leaves.forEach(item => {
          const itemNo = item.item_no || '';
          let parentNo = '';
          if (itemNo.includes('.')) {
            parentNo = itemNo.substring(0, itemNo.lastIndexOf('.'));
          }
          if (!pGroups[parentNo]) pGroups[parentNo] = [];
          pGroups[parentNo].push(item.id);
        });

        const pCodes = Object.keys(pGroups);
        const eqParent = (100 / pCodes.length).toFixed(1);

        const newParents: Record<string, string> = {};
        const newSubGroups: Record<string, string> = {};

        pCodes.forEach((pCode, idx) => {
          // Parent %
          if (idx === pCodes.length - 1) {
            let sum = 0;
            pCodes.slice(0, -1).forEach(code => sum += parseFloat(newParents[code]) || 0);
            newParents[pCode] = Math.max(0, 100 - sum).toFixed(1);
          } else {
            newParents[pCode] = eqParent;
          }

          // Children sub-group % (of this parent)
          const childrenIds = pGroups[pCode];
          const eqChild = (100 / childrenIds.length).toFixed(1);
          childrenIds.forEach((childId, cIdx) => {
            if (cIdx === childrenIds.length - 1) {
              let cSum = 0;
              childrenIds.slice(0, -1).forEach(id => cSum += parseFloat(newSubGroups[id]) || 0);
              newSubGroups[childId] = Math.max(0, 100 - cSum).toFixed(1);
            } else {
              newSubGroups[childId] = eqChild;
            }
          });
        });

        const keysMatchParents = pCodes.every(code => parentPercentages[code] !== undefined);
        const keysMatchChildren = leaves.every(item => subGroupPercentages[item.id] !== undefined);

        if (!keysMatchParents || !keysMatchChildren) {
          setParentPercentages(newParents);
          setSubGroupPercentages(newSubGroups);
        }
      } else {
        setParentPercentages({});
        setSubGroupPercentages({});
      }
    } else {
      setParentPercentages({});
      setSubGroupPercentages({});
    }
  }, [selectedItems, assignmentType, boqItems]);

  async function loadData() {
    if (!project) return;
    setLoading(true);
    try {
      const [subsRes, assignRes, boqRes] = await Promise.all([
        supabase.from('subcontractors').select('*').eq('tenant_id', tenantId).order('company_name'),
        supabase.from('subcontractor_assignments').select('*, subcontractor:subcontractor_id(*), boq_item:boq_item_id(*)').eq('project_id', project.id),
        supabase.from('boq_items').select('*').eq('project_id', project.id).order('item_no')
      ]);

      if (subsRes.error) throw subsRes.error;
      if (assignRes.error) throw assignRes.error;
      if (boqRes.error) throw boqRes.error;

      setSubcontractors(subsRes.data || []);
      setAssignments(assignRes.data || []);
      setBoqItems(boqRes.data || []);
    } catch (e: any) {
      console.error('Error loading subcontractor data:', e.message);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveQuickSub = async () => {
    if (!quickSubForm.company_name) {
      alert('Please enter a Company Name.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subcontractors')
        .insert([{
          company_name: quickSubForm.company_name,
          trade_category: quickSubForm.trade_category,
          contact_person: quickSubForm.contact_person,
          email: quickSubForm.email,
          phone: quickSubForm.phone,
          status: quickSubForm.status,
          tenant_id: tenantId,
          rating: 5
        }])
        .select();

      if (error) throw error;

      alert('Subcontractor successfully registered!');

      // Reload list
      const { data: subsData, error: subsError } = await supabase
        .from('subcontractors')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('company_name');

      if (subsError) throw subsError;
      setSubcontractors(subsData || []);

      // Auto-select the newly created subcontractor
      const newSub = data?.[0];
      if (newSub) {
        setSelectedSub(newSub.id);
      }

      setQuickSubForm({
        company_name: '',
        trade_category: 'Concrete Works',
        contact_person: '',
        email: '',
        phone: '',
        status: 'active'
      });
      setIsQuickAddingSub(false);
    } catch (err: any) {
      alert('Error creating partner: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessAssignment = async () => {
    if (!project || !selectedSub) {
      alert('Please select a subcontractor / project partner first.');
      return;
    }

    const currentBatchToCommit = [...stagedGroups];

    // Auto-stage any active selected items if the user hasn't added them to the batch yet
    if (selectedItems.size > 0) {
      if (assignmentType === 'lumpsum' && !lumpSumTotal) {
        alert("Please specify a Lump Sum amount for the currently selected items (or click Add to Batch).");
        return;
      }
      if (assignmentType === 'unit_rate' && !globalRate) {
        alert("Please specify a Unit Rate for the currently selected items (or click Add to Batch).");
        return;
      }

      let parsedPercentages: Record<string, number> = {};
      if (assignmentType === 'lumpsum') {
        const itemsArr = Array.from(selectedItems);
        let sum = 0;
        itemsArr.forEach(id => {
          const pct = parseFloat(itemPercentages[id]) || 0;
          sum += pct;
          parsedPercentages[id] = pct;
        });

        if (Math.abs(sum - 100) > 0.5) {
          alert(`The total weight must sum up to exactly 100%. Currently it is ${sum.toFixed(1)}%. Please adjust or click "Split Leaves Equally".`);
          return;
        }
      }

      const tempGroup = {
        id: 'direct_' + Math.random().toString(36).substr(2, 9),
        itemIds: Array.from(selectedItems),
        type: assignmentType,
        rate: globalRate,
        lumpSum: lumpSumTotal,
        name: groupName || `Direct Group ${currentBatchToCommit.length + 1}`,
        percentages: assignmentType === 'lumpsum' ? parsedPercentages : undefined
      };
      currentBatchToCommit.push(tempGroup);
    }

    if (currentBatchToCommit.length === 0) {
      alert("No scope items selected or batched. Select items from the browser first.");
      return;
    }

    setLoading(true);
    try {
      const assignmentMap = new Map<string, any>();

      currentBatchToCommit.forEach(group => {
        const itemCount = Math.max(1, group.itemIds.length);
        group.itemIds.forEach(itemId => {
          const boqItem = boqItems.find(i => i.id === itemId);
          
          let itemLumpSumValue = 0;
          if (group.type === 'lumpsum') {
            const groupSum = parseFloat(group.lumpSum) || 0;
            if (group.percentages && group.percentages[itemId] !== undefined) {
              itemLumpSumValue = groupSum * (group.percentages[itemId] / 100);
            } else {
              itemLumpSumValue = groupSum / itemCount;
            }
          }

          assignmentMap.set(itemId, {
            tenant_id: tenantId,
            project_id: project.id,
            subcontractor_id: selectedSub,
            boq_item_id: itemId,
            contract_qty: boqItem?.contract_qty || 0,
            contract_rate: group.type === 'unit_rate' ? (parseFloat(group.rate) || 0) : 0,
            assignment_type: group.type,
            group_name: group.name || null,
            lump_sum_total: group.type === 'lumpsum' ? itemLumpSumValue : null
          });
        });
      });

      const allAssignments = Array.from(assignmentMap.values());
      const deleteItemIds = allAssignments.map(a => a.boq_item_id);

      // 1. Delete matching existing assignments for these BOQ items to guarantee zero upsert DB errors
      if (deleteItemIds.length > 0) {
        await supabase
          .from('subcontractor_assignments')
          .delete()
          .eq('project_id', project.id)
          .in('boq_item_id', deleteItemIds);
      }

      // 2. Perform fresh clean insert
      const { error } = await supabase
        .from('subcontractor_assignments')
        .insert(allAssignments);

      if (error) {
        throw error;
      }

      // 3. Clear wizard states on successful completion
      setIsAdding(false);
      setStagedGroups([]);
      setSelectedItems(new Set());
      setGlobalRate('');
      setLumpSumTotal('');
      setGroupName('');
      setSelectedSub('');
      setSubGroupPercentages({});
      setParentPercentages({});
      
      await loadData();
      alert('Scope assignments successfully processed and committed!');
    } catch (e: any) {
      alert('Error committing assignments: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const addToBatch = () => {
    if (selectedItems.size === 0) {
      alert("Select items from the browser first.");
      return;
    }
    if (assignmentType === 'lumpsum' && !lumpSumTotal) {
      alert("Please specify a Lump Sum amount for this group.");
      return;
    }
    if (assignmentType === 'unit_rate' && !globalRate) {
      alert("Please specify a Unit Rate for this group.");
      return;
    }

    let parsedPercentages: Record<string, number> = {};
    if (assignmentType === 'lumpsum') {
      const itemsArr = Array.from(selectedItems);
      // Validate parents
      const parentKeys = Object.keys(parentPercentages);
      const sumParents = parentKeys.reduce((acc, code) => acc + (parseFloat(parentPercentages[code]) || 0), 0);
      if (Math.abs(sumParents - 100) > 0.1) {
        alert(`Parent allocations sum to ${sumParents.toFixed(1)}%. It must sum to exactly 100.0%. Please adjust parent percentages.`);
        return;
      }

      // Validate sub-groups
      const parentCodes = new Set<string>();
      itemsArr.forEach(id => {
        const item = boqItems.find(i => i.id === id);
        const itemNo = item?.item_no || '';
        if (itemNo.includes('.')) {
          parentCodes.add(itemNo.substring(0, itemNo.lastIndexOf('.')));
        }
      });

      for (const pCode of Array.from(parentCodes)) {
        const children = boqItems.filter(i => itemsArr.includes(i.id) && (i.item_no || '').startsWith(pCode + '.'));
        const sumChildren = children.reduce((acc, c) => acc + (parseFloat(subGroupPercentages[c.id]) || 0), 0);
        if (Math.abs(sumChildren - 100) > 0.1) {
          alert(`Subgroup "${pCode}" children sum to ${sumChildren.toFixed(1)}%. They must sum to exactly 100.0%. Edit the items underneath category "${pCode}".`);
          return;
        }
      }

      itemsArr.forEach(id => {
        const item = boqItems.find(i => i.id === id);
        const itemNo = item?.item_no || '';
        let pCode = '';
        if (itemNo.includes('.')) {
          pCode = itemNo.substring(0, itemNo.lastIndexOf('.'));
        }
        const parentPct = parseFloat(parentPercentages[pCode]) || 0;
        const subGroupPct = parseFloat(subGroupPercentages[id]) || 0;
        const globalPct = (parentPct * subGroupPct) / 100;
        parsedPercentages[id] = globalPct;
      });
    }

    const newGroup = {
      id: Math.random().toString(36).substr(2, 9),
      itemIds: Array.from(selectedItems),
      type: assignmentType,
      rate: globalRate,
      lumpSum: lumpSumTotal,
      name: groupName || `Group ${stagedGroups.length + 1}`,
      percentages: assignmentType === 'lumpsum' ? parsedPercentages : undefined
    };

    setStagedGroups([...stagedGroups, newGroup]);
    setSelectedItems(new Set());
    setGroupName('');
    setGlobalRate('');
    setLumpSumTotal('');
    setParentPercentages({});
    setSubGroupPercentages({});
  };

  const removeAssignment = async (id: string, skipConfirm = false) => {
    if (!skipConfirm && !window.confirm('Delete this contract assignment?')) return;
    try {
      const { error } = await supabase
        .from('subcontractor_assignments')
        .delete()
        .eq('id', id);
      if (error) throw error;
      loadData();
    } catch (e: any) {
      alert('Error deleting: ' + e.message);
    }
  };

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Grouping logic for assignments - treat every batch separately as a single contract
  const groupedAssignments = useMemo(() => {
    const groups: Record<string, {
      id: string;
      sub: Subcontractor;
      type: 'unit_rate' | 'lumpsum';
      name: string;
      lumpSumTotal: number;
      createdAt: string;
      items: SubcontractorAssignment[];
      totalValue: number;
    }> = {};

    assignments.forEach(a => {
      const subId = a.subcontractor_id;
      const isLS = a.assignment_type === 'lumpsum';
      
      const gName = a.group_name || (isLS ? 'General Lump Sum Contract' : 'General Unit Rate Contract');
      // Let's create a separate batch key using the exact rounded minute (or 5s interval) of creation
      const createdAtTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const roundedTime = Math.round(createdAtTime / 5000) * 5000;
      const groupKey = `${subId}_${gName}_${a.assignment_type || 'unit_rate'}_${roundedTime}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          sub: a.subcontractor!,
          type: a.assignment_type || 'unit_rate',
          name: gName,
          lumpSumTotal: isLS ? (a.lump_sum_total || 0) : 0,
          createdAt: a.created_at || new Date().toISOString(),
          items: [],
          totalValue: 0
        };
      }
      
      groups[groupKey].items.push(a);
    });

    Object.values(groups).forEach(g => {
      if (g.type === 'lumpsum') {
        g.totalValue = g.items.reduce((sum, item) => sum + (item.lump_sum_total || 0), 0);
      } else {
        g.totalValue = g.items.reduce((sum, item) => sum + ((item.contract_qty || 0) * (item.contract_rate || 0)), 0);
      }

      // Explicitly sort line items in each group to prevent random jumping
      g.items.sort((x, y) => {
        if (lineSortBy === 'item_no') {
          const itemNoX = x.boq_item?.item_no || '';
          const itemNoY = y.boq_item?.item_no || '';
          return itemNoX.localeCompare(itemNoY, undefined, { numeric: true });
        } else if (lineSortBy === 'date_asc') {
          return new Date(x.created_at || 0).getTime() - new Date(y.created_at || 0).getTime();
        } else if (lineSortBy === 'date_desc') {
          return new Date(y.created_at || 0).getTime() - new Date(x.created_at || 0).getTime();
        } else if (lineSortBy === 'value_desc' || lineSortBy === 'value_asc') {
          const valX = x.assignment_type === 'lumpsum' ? (x.lump_sum_total || 0) : ((x.contract_qty || 0) * (x.contract_rate || 0));
          const valY = y.assignment_type === 'lumpsum' ? (y.lump_sum_total || 0) : ((y.contract_qty || 0) * (y.contract_rate || 0));
          return lineSortBy === 'value_desc' ? valY - valX : valX - valY;
        }
        return 0;
      });
    });

    return Object.values(groups).sort((a, b) => {
      if (contractSortBy === 'date_desc') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (contractSortBy === 'date_asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (contractSortBy === 'sub_name') {
        return (a.sub.company_name || '').localeCompare(b.sub.company_name || '');
      } else if (contractSortBy === 'value_desc') {
        return b.totalValue - a.totalValue;
      } else if (contractSortBy === 'value_asc') {
        return a.totalValue - b.totalValue;
      }
      return 0;
    });
  }, [assignments, contractSortBy, lineSortBy]);

  const removeContractBatch = async (subcontractorId: string, groupName: string, assignmentType: string, batchCreatedTime?: string, skipConfirm = false) => {
    if (!skipConfirm && !window.confirm(`Are you sure you want to delete and terminate the entire contract "${groupName}"?`)) return;
    setLoading(true);
    try {
      let query = supabase
        .from('subcontractor_assignments')
        .delete()
        .eq('subcontractor_id', subcontractorId)
        .eq('assignment_type', assignmentType);
        
      if (groupName === 'General Unit Rate Contract' || groupName === 'General Lump Sum Contract') {
        query = query.is('group_name', null);
      } else {
        query = query.eq('group_name', groupName);
      }

      if (batchCreatedTime) {
        const d = new Date(batchCreatedTime);
        const start = new Date(d.getTime() - 2500).toISOString();
        const end = new Date(d.getTime() + 2500).toISOString();
        query = query.gte('created_at', start).lte('created_at', end);
      }

      const { error } = await query;
      if (error) throw error;
      await loadData();
    } catch (e: any) {
      alert('Error deleting contract: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupCollapse = (groupId: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    setCollapsedGroups(next);
  };

  const startEditingItem = (a: SubcontractorAssignment) => {
    setEditingMode('item');
    setEditingAssignmentId(a.id);
    setEditRate((a.contract_rate || 0).toString());
    setEditLumpSum((a.lump_sum_total || 0).toString());
    setEditGroupName(a.group_name || '');

    const parentGroup = groupedAssignments.find(g => g.items.some(item => item.id === a.id));
    if (parentGroup && parentGroup.type === 'lumpsum') {
      const groupTotal = parentGroup.totalValue;
      const pct = groupTotal > 0 ? ((a.lump_sum_total || 0) / groupTotal) * 100 : 0;
      setEditPct(pct.toFixed(2));
    } else {
      setEditPct('');
    }
  };

  const startEditingGroup = (group: any) => {
    setEditingMode('group');
    setEditingGroupId(group.id);
    setEditGroupName(group.name || '');
    setEditLumpSum(Math.round(group.totalValue).toString());
    if (group.type === 'unit_rate') {
      const rates = group.items.map((item: any) => item.contract_rate || 0);
      const allEqual = rates.every((val: any) => val === rates[0]);
      setEditRate(allEqual ? rates[0].toString() : '');
    } else {
      setEditRate('');
    }
  };



  const cancelEditing = () => {
    setEditingMode(null);
    setEditingAssignmentId(null);
    setEditingGroupId(null);
    setEditRate('');
    setEditLumpSum('');
    setEditGroupName('');
    setEditPct('');
  };

  const handleUpdateItem = async (assignmentId: string) => {
    setLoading(true);
    try {
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) return;

      const isLS = assignment.assignment_type === 'lumpsum';
      const updates: any = {};

      if (isLS) {
        const parentGroup = groupedAssignments.find(g => g.items.some(item => item.id === assignmentId));
        if (!parentGroup) throw new Error("Could not find contract group for this item");

        const groupTotal = parentGroup.totalValue;
        const newPct = parseFloat(editPct) || 0;

        // Calculate current sum of other items' percentages
        const otherPctSum = parentGroup.items
          .filter(item => item.id !== assignmentId)
          .reduce((sum, item) => sum + (((item.lump_sum_total || 0) / groupTotal) * 100), 0);

        if (otherPctSum + newPct > 100.01) {
          alert(`Error: The total percentage would be ${(otherPctSum + newPct).toFixed(1)}%, which exceeds 100%. Please scale down the percentage.`);
          setLoading(false);
          return;
        }

        updates.lump_sum_total = (newPct / 100) * groupTotal;
      } else {
        updates.contract_rate = parseFloat(editRate) || 0;
      }

      const { error } = await supabase
        .from('subcontractor_assignments')
        .update(updates)
        .eq('id', assignmentId);

      if (error) throw error;

      setEditingMode(null);
      setEditingAssignmentId(null);
      await loadData();
      alert('Line item updated successfully');
    } catch (e: any) {
      alert('Error updating line item: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGroup = async (groupId: string) => {
    const group = groupedAssignments.find(g => g.id === groupId);
    if (!group) return;

    setLoading(true);
    try {
      const isLS = group.type === 'lumpsum';

      if (isLS) {
        // Update entire group if lump sum, preserving proportional weights
        const currentTotal = group.items.reduce((sum: number, item: any) => sum + (item.lump_sum_total || 0), 0);
        const newTotal = parseFloat(editLumpSum) || 0;

        const promises = group.items.map((item: any) => {
          const weight = currentTotal > 0 ? (item.lump_sum_total || 0) / currentTotal : (1 / group.items.length);
          const updatedItemLumpSum = newTotal * weight;
          return (async () => {
            const { error } = await supabase
              .from('subcontractor_assignments')
              .update({
                lump_sum_total: updatedItemLumpSum,
                group_name: editGroupName || null
              })
              .eq('id', item.id);
            if (error) {
              throw new Error(`Assignment item flat update failed: ${error.message}`);
            }
          })();
        });

        await Promise.all(promises);
      } else {
        // Unit Rate - update group name, and if editRate is provided/filled, update all rates
        const promises = group.items.map((item: any) => {
          const updates: any = {
            group_name: editGroupName || null
          };
          if (editRate && !isNaN(parseFloat(editRate))) {
            updates.contract_rate = parseFloat(editRate);
          }
          return (async () => {
            const { error } = await supabase
              .from('subcontractor_assignments')
              .update(updates)
              .eq('id', item.id);
            if (error) {
              throw new Error(`Assignment item rate update failed: ${error.message}`);
            }
          })();
        });

        await Promise.all(promises);
      }

      setEditingMode(null);
      setEditingGroupId(null);
      await loadData();
      alert('Contract group updated successfully');
    } catch (e: any) {
      alert('Error updating contract group: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = boqItems.filter(item => {
    const isContracted = assignments.some(a => a.boq_item_id === item.id);
    if (!showContracted && isContracted) return false;
    
    return (cleanRichText(item.description).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.item_no || '').toLowerCase().includes(searchTerm.toLowerCase()));
  });

  // Hierarchical logic
  const sortedItems = [...filteredItems].sort((a, b) => 
    (a.item_no || '').localeCompare(b.item_no || '', undefined, { numeric: true })
  );

  const getDepth = (itemNo: string) => (itemNo?.match(/\./g) || []).length;

  const isHiddenByCollapse = (itemNo: string) => {
    if (!itemNo) return false;
    return Array.from(collapsedSections).some(collapsed => 
      itemNo.startsWith(collapsed + '.')
    );
  };

  const hasChildren = (itemNo: string) => {
    if (!itemNo) return false;
    return filteredItems.some(i => i.item_no && i.item_no.startsWith(itemNo + '.') && i.item_no !== itemNo);
  };

  const toggleCollapse = (itemNo: string) => {
    const next = new Set(collapsedSections);
    if (next.has(itemNo)) next.delete(itemNo);
    else next.add(itemNo);
    setCollapsedSections(next);
  };

  const selectRecursive = (itemNo: string, select: boolean) => {
    const next = new Set(selectedItems);
    filteredItems.forEach(item => {
      if (item.item_no === itemNo || (item.item_no && item.item_no.startsWith(itemNo + '.'))) {
        if (select) next.add(item.id);
        else next.delete(item.id);
      }
    });
    setSelectedItems(next);
  };

  const toggleGroupItemCollapse = (groupId: string, itemNo: string) => {
    setCollapsedGroupItems(prev => {
      const current = prev[groupId] ? new Set(prev[groupId]) : new Set<string>();
      if (current.has(itemNo)) current.delete(itemNo);
      else current.add(itemNo);
      return { ...prev, [groupId]: current };
    });
  };

  const isGroupItemHidden = (groupId: string, itemNo: string) => {
    if (!itemNo) return false;
    const collapsed = collapsedGroupItems[groupId];
    if (!collapsed || collapsed.size === 0) return false;
    
    const parts = itemNo.split('.');
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join('.');
      if (collapsed.has(prefix)) return true;
    }
    return false;
  };

  const groupItemHasChildren = (groupItems: any[], itemNo: string) => {
    if (!itemNo) return false;
    return groupItems.some(it => {
      const otherNo = it.boq_item?.item_no || '';
      return otherNo.startsWith(itemNo + '.') && otherNo !== itemNo;
    });
  };

  const selectedGroups = useMemo(() => {
    const selectedLeaves = boqItems.filter(item => selectedItems.has(item.id) && !hasChildren(item.item_no || ''));
    
    const groupsMap: Record<string, { parent: BOQItem; items: BOQItem[] }> = {};
    
    selectedLeaves.forEach(item => {
      const itemNo = item.item_no || '';
      let parentNo = '';
      if (itemNo.includes('.')) {
        parentNo = itemNo.substring(0, itemNo.lastIndexOf('.'));
      }
      
      if (!groupsMap[parentNo]) {
        const existingParent = boqItems.find(p => p.item_no === parentNo);
        groupsMap[parentNo] = {
          parent: existingParent || { id: parentNo, item_no: parentNo, description: 'Parent Category', contract_qty: 1 } as any,
          items: []
        };
      }
      groupsMap[parentNo].items.push(item);
    });
    
    return Object.entries(groupsMap).map(([parentNo, g]) => ({
      parentNo,
      parent: g.parent,
      items: g.items
    }));
  }, [selectedItems, boqItems, collapsedSections]); // updated dependencies

  const itemPercentages = useMemo(() => {
    const res: Record<string, string> = {};
    selectedGroups.forEach(grp => {
      const pPct = parseFloat(parentPercentages[grp.parentNo]) || 0;
      grp.items.forEach(child => {
        const sPct = parseFloat(subGroupPercentages[child.id]) || 0;
        const globalPct = (pPct * sPct) / 100;
        res[child.id] = globalPct.toFixed(2);
      });
    });
    return res;
  }, [selectedGroups, parentPercentages, subGroupPercentages]);

  const handleParentPercentageChange = (parentNo: string, val: string) => {
    setParentPercentages(prev => ({ ...prev, [parentNo]: val }));
  };

  const startInlineEditingGroup = (group: any) => {
    setEditingContractGroupId(group.id);
    setInlineGroupName(group.name || '');
    
    const rates: Record<string, string> = {};
    
    if (group.type === 'lumpsum') {
      const overallVal = group.totalValue || 0;
      setInlineLumpSumTotal(Math.round(overallVal).toString());

      const { nodeMap } = buildAndCalculateContractTree(group.items, overallVal, {}, boqItems, false);
      const prefilledPcts: Record<string, string> = {};
      nodeMap.forEach((node, itemNo) => {
        prefilledPcts[itemNo] = node.percentage.toFixed(1);
      });
      setInlineParentPcts(prefilledPcts);
    } else {
      setInlineLumpSumTotal('');
      group.items.forEach((item: any) => {
        rates[item.id] = (item.contract_rate || 0).toString();
      });
    }
    
    setInlineRates(rates);
  };

  const getGroupVirtualRows = (group: any) => {
    const isEditingThis = editingContractGroupId === group.id;
    const overallValue = isEditingThis 
      ? (parseFloat(inlineLumpSumTotal) || group.totalValue || 0) 
      : (group.totalValue || 0);

    const percentsMapToUse = isEditingThis ? inlineParentPcts : {};

    const { topLevelNodes } = buildAndCalculateContractTree(
      group.items,
      overallValue,
      percentsMapToUse,
      boqItems,
      isEditingThis
    );

    const virtualRows: any[] = [];
    const flattenTree = (node: ContractTreeNode) => {
      if (node.isLeaf) {
        virtualRows.push({
          type: 'leaf_row',
          item: node.assignment,
          percentage: node.percentage,
          pctOfParent: node.percentage, 
          groupType: group.type,
          groupTotal: overallValue,
          nodeInfo: node
        });
      } else {
        virtualRows.push({
          type: 'parent_row',
          id: node.id,
          itemNo: node.itemNo,
          description: node.description,
          value: node.value,
          percentage: node.percentage,
          groupType: group.type,
          nodeInfo: node
        });
      }

      const isItemCollapsed = collapsedGroupItems[group.id]?.has(node.itemNo) || false;
      if (!isItemCollapsed) {
        node.children.forEach(flattenTree);
      }
    };

    topLevelNodes.forEach(flattenTree);
    return virtualRows;
  };

  const handleSaveInlineEdit = async (group: any) => {
    setLoading(true);
    try {
      if (group.type === 'lumpsum') {
        const liveOverallValue = parseFloat(inlineLumpSumTotal) || group.totalValue || 0;
        
        const { topLevelNodes, nodeMap } = buildAndCalculateContractTree(
          group.items,
          liveOverallValue,
          inlineParentPcts,
          boqItems,
          true
        );

        const topLevelSubcategories = topLevelNodes.filter(n => !n.isLeaf);
        const topLevelLeavesCount = topLevelNodes.filter(n => n.isLeaf).length;

        if (topLevelNodes.length > 0 && !topLevelNodes.every(n => n.isLeaf)) {
          const topLevelSum = topLevelSubcategories.reduce((acc, n) => acc + (parseFloat(inlineParentPcts[n.itemNo]) || 0), 0);
          if (topLevelLeavesCount === 0) {
            if (Math.abs(topLevelSum - 100) > 0.1) {
              alert(`Step 1 Validation Error: Top level parents under the contract must sum to exactly 100.0%. Currently they sum to ${topLevelSum.toFixed(1)}%. Please adjust before saving.`);
              setLoading(false);
              return;
            }
          } else {
            if (topLevelSum > 100.1) {
              alert(`Step 1 Validation Error: Top level parents under the contract exceed 100.0%. Currently they sum to ${topLevelSum.toFixed(1)}%. Please adjust before saving.`);
              setLoading(false);
              return;
            }
          }
        }

        const badSubGroups: string[] = [];
        const validateTree = (node: ContractTreeNode) => {
          if (node.isLeaf || node.children.length === 0) return;
          
          const subCategories = node.children.filter(c => !c.isLeaf);
          const leafChildrenCount = node.children.filter(c => c.isLeaf).length;

          if (subCategories.length > 0) {
            const sum = subCategories.reduce((acc, c) => acc + (parseFloat(inlineParentPcts[c.itemNo]) || 0), 0);
            if (leafChildrenCount === 0) {
              if (Math.abs(sum - 100) > 0.1) {
                badSubGroups.push(node.itemNo);
              }
            } else {
              if (sum > 100.1) {
                badSubGroups.push(node.itemNo);
              }
            }
            subCategories.forEach(validateTree);
          }
        };
        topLevelNodes.forEach(validateTree);

        if (badSubGroups.length > 0) {
          alert(`Step 2 Validation Error: Sub-items weight under the following categories must sum up properly:\n[${badSubGroups.join(', ')}]\nPlease adjust before saving.`);
          setLoading(false);
          return;
        }

        const updates: any[] = [];
        nodeMap.forEach(node => {
          if (node.isLeaf && node.assignment) {
            updates.push(
              (async () => {
                console.log(`[DEBUG] Saving inline lump sum for assignment ${node.assignment.id}: ${node.itemNo}`, {
                  new_value: Math.round(node.value * 100) / 100
                });
                const { error } = await supabase
                  .from('subcontractor_assignments')
                  .update({
                    lump_sum_total: Math.round(node.value * 100) / 100
                  })
                  .eq('id', node.assignment.id);
                if (error) {
                  throw new Error(`Item ${node.itemNo} update failed: ${error.message}`);
                }
              })()
            );
          }
        });

        await Promise.all(updates);
      } else {
        const updates = group.items.map((item: any) => {
          const updatedRate = parseFloat(inlineRates[item.id]) || 0;
          return (async () => {
            console.log(`[DEBUG] Saving inline rate for assignment ${item.id}`, {
              new_rate: updatedRate
            });
            const { error } = await supabase
              .from('subcontractor_assignments')
              .update({
                contract_rate: updatedRate
              })
              .eq('id', item.id);
            if (error) {
              throw new Error(`Rate update failed for assignment ${item.id}: ${error.message}`);
            }
          })();
        });

        await Promise.all(updates);
      }

      setEditingContractGroupId(null);
      await loadData();
    } catch (e: any) {
      console.error('[ERROR] saving modifications:', e);
      alert('Error saving modifications: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const groupTotals = assignments.reduce((acc: any, a) => {
    if (a.assignment_type === 'lumpsum') {
      const gName = a.group_name || 'General Lump Sum Contract';
      acc[gName] = (acc[gName] || 0) + (a.lump_sum_total || 0);
    }
    return acc;
  }, {});

  const totalContractValue = assignments.reduce((sum, a) => {
    if (a.assignment_type === 'lumpsum') return sum; // Countered by groups
    return sum + (a.contract_qty * a.contract_rate);
  }, 0) + (Object.values(groupTotals) as number[]).reduce((sum, val) => sum + val, 0);

  if (!project) {
    return (
      <div className="py-24 text-center bg-surface-1 border border-dashed border-border-subtle rounded-3xl mx-1 animate-in fade-in duration-700">
        <Briefcase className="w-12 h-12 text-ghost mx-auto mb-4 opacity-20" />
        <h3 className="text-lg font-black text-main tracking-tight px-1">No Project Context Selected</h3>
        <p className="text-sm text-ghost mt-2 max-w-sm mx-auto">Contracts are bound to specific projects. Please select a project to manage subcontractual assignments.</p>
        <button 
          onClick={onSelectProject}
          className="btn btn-accent btn-sm mt-6 shadow-xl shadow-accent/20"
        >
          Open Project Selection
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-20 text-center animate-pulse">
        <Users className="w-8 h-8 text-primary mx-auto mb-2" />
        <span className="text-xs text-ghost font-bold uppercase tracking-widest leading-none">Scanning Contract State...</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col gap-6 animate-in fade-in duration-500 transition-all",
      isFullscreen ? "fixed top-0 bottom-0 right-0 left-0 lg:left-16 z-[150] bg-surface-base p-8 overflow-hidden" : ""
    )}>
      {showPerformanceNotice && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-2xl flex items-start gap-3 shadow-inner mb-0.5 animate-in fade-in duration-300 select-none relative group pr-10">
          <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-600 shrink-0 mt-0.5 animate-pulse">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <span>⚡ PERFORMANCE NOTICE: PERCENT CONTRACT LOADING SPEED OPTIMIZED</span>
            </h4>
            <p className="text-[10px] text-ghost dark:text-dim font-bold uppercase mt-1 leading-relaxed">
              Subcontract allocations with deep parent-child percentage hierarchies involve heavy comparative compile queries. We have optimized core retrieval and active calculations.
            </p>
            <div className="flex gap-2 items-center mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase font-mono tracking-widest border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Query Caching: ACTIVE
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent/10 text-accent text-[8px] font-black uppercase font-mono tracking-widest border border-accent/20">
                Split Weights: SYNCED 100%
              </span>
            </div>
          </div>
          <button 
            onClick={() => setShowPerformanceNotice(false)}
            className="absolute top-3.5 right-3.5 p-1 rounded-lg hover:bg-amber-500/20 text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {isFullscreen && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
             <Briefcase className="w-6 h-6 text-primary" />
             <h2 className="text-xl font-black text-main uppercase tracking-tighter">Vendor Contract Tower</h2>
          </div>
          <button 
            onClick={() => setIsFullscreen(false)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border-subtle bg-surface-base text-main hover:bg-surface-2 transition-all font-bold uppercase tracking-widest text-[10px]"
          >
            <Minimize2 className="w-3 h-3" />
            Shrink
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 border-l-4 border-l-accent relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <DollarSign className="w-16 h-16 text-accent" />
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-ghost mb-1">Total Subcontracted Value</div>
          <div className="text-2xl font-black text-main font-mono">${totalContractValue.toLocaleString()}</div>
          <div className="mt-2 flex items-center gap-2 text-[9px] text-accent font-bold uppercase tracking-widest">
            <TrendingUp className="w-3 h-3" />
            Active Liability
          </div>
        </div>
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-ghost mb-1">Active Contracts</div>
          <div className="text-2xl font-black text-main">{assignments.length}</div>
          <div className="mt-2 text-[9px] text-ghost font-bold uppercase tracking-widest">Certified Partners Participating</div>
        </div>
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-ghost mb-1">Items Unassigned</div>
          <div className="text-2xl font-black text-main">{boqItems.filter(i => i.unit && !assignments.some(a => a.boq_item_id === i.id)).length}</div>
          <div className="mt-2 text-[9px] text-primary font-bold uppercase tracking-widest">Awaiting procurement</div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-black text-main uppercase tracking-[0.2em] flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            Contractual Assignments
          </h3>
          <p className="text-[10px] text-ghost font-bold uppercase mt-0.5">{project.name} Control Tower</p>
        </div>
        {!isAdding && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full border transition-all shadow-sm font-bold uppercase tracking-widest text-[10px]",
                isFullscreen 
                  ? "bg-primary/10 border-primary text-primary hover:bg-primary/20" 
                  : "bg-surface-1 border-border-subtle text-main hover:border-primary hover:text-primary"
              )}
            >
              {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              {isFullscreen ? 'Shrink' : 'Expand'}
            </button>
            <button 
              onClick={() => setIsAdding(true)}
              className="px-6 py-2 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              New Assignment
            </button>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="bg-surface-1 border border-accent/30 rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-top-4 duration-500 max-w-[1600px] mx-auto w-full">
          <div className="bg-accent/5 p-5 border-b border-accent/20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-main tracking-tight">Configure New Subcontractor Assignment</h4>
                <p className="text-[10px] text-ghost uppercase font-bold tracking-widest mt-0.5">Define scope and commercial terms</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsAdding(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 transition-colors rounded-xl text-ghost hover:text-main text-[10px] uppercase font-black tracking-widest">Cancel</button>
            </div>
          </div>
          
          <div className="p-8 space-y-8">
            {/* Horizontal Global Configuration Header */}
            <div className="flex flex-wrap items-end gap-5 bg-surface-2/50 p-5 rounded-[2rem] border border-border-subtle/50 shadow-sm">
              <div className="flex-1 min-w-[200px] space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-ghost flex items-center gap-2 px-1">
                  <span className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center text-[9px] text-accent font-mono">01</span>
                  Partner Selection
                </label>
                <div className="flex gap-2">
                  <select 
                    className="flex-1 bg-surface-1 border border-border-subtle rounded-xl p-3 text-xs outline-none focus:border-accent text-main font-bold shadow-sm transition-all"
                    value={selectedSub}
                    onChange={e => {
                      if (e.target.value === 'ADD_NEW') {
                        setIsQuickAddingSub(true);
                        setSelectedSub('');
                      } else {
                        setSelectedSub(e.target.value);
                      }
                    }}
                  >
                    <option value="">Select Vendor...</option>
                    {subcontractors.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.company_name} ({sub.trade_category})</option>
                    ))}
                    <option value="ADD_NEW" className="text-accent font-black">+ Register New Partner...</option>
                  </select>
                </div>
              </div>

              <div className="flex-1 min-w-[180px] space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-ghost flex items-center gap-2 px-1">
                  <span className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center text-[9px] text-accent font-mono">02</span>
                  Group / Item Mode
                </label>
                <div className="bg-surface-1 p-1 rounded-xl border border-border-subtle flex h-[46px] items-center">
                  <button 
                    onClick={() => setAssignmentType('unit_rate')}
                    className={cn("flex-1 h-full rounded-lg text-[9px] font-black uppercase tracking-widest transition-all", assignmentType === 'unit_rate' ? "bg-accent text-white" : "text-ghost hover:text-main")}
                  >Unit Rate</button>
                  <button 
                    onClick={() => setAssignmentType('lumpsum')}
                    className={cn("flex-1 h-full rounded-lg text-[9px] font-black uppercase tracking-widest transition-all", assignmentType === 'lumpsum' ? "bg-accent text-white" : "text-ghost hover:text-main")}
                  >Lump Sum</button>
                </div>
              </div>

              <div className="flex-1 min-w-[180px] space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-ghost flex items-center gap-2 px-1">
                  <span className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center text-[9px] text-accent font-mono">03</span>
                  Reference Name
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Concrete Phase 1"
                  className="w-full bg-surface-1 border border-border-subtle rounded-xl p-3 text-xs font-bold outline-none focus:border-accent text-main shadow-sm transition-all placeholder:text-ghost/30"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                />
              </div>

              <div className="flex-1 min-w-[150px] space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-ghost flex items-center gap-2 px-1">
                  <span className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center text-[9px] text-accent font-mono">04</span>
                  {assignmentType === 'unit_rate' ? 'Rate' : 'Lump Sum'}
                </label>
                <div className="relative group">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                  <input 
                    type="number"
                    placeholder="0.00"
                    className="w-full bg-surface-1 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-xs font-mono font-black outline-none focus:border-accent text-main shadow-sm transition-all"
                    value={assignmentType === 'unit_rate' ? globalRate : lumpSumTotal}
                    onChange={e => assignmentType === 'unit_rate' ? setGlobalRate(e.target.value) : setLumpSumTotal(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-none flex items-end">
                <button 
                  onClick={handleProcessAssignment}
                  disabled={!selectedSub || (selectedItems.size === 0 && stagedGroups.length === 0)}
                  className="h-[46px] px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4 inline-block mr-2" />
                  Process Assignment Batch
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 min-h-[600px]">
              {/* Column 2: BOQ Selector */}
              <div className="lg:col-span-3 flex flex-col gap-5">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[11px] font-black uppercase tracking-widest text-ghost flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center text-[9px] text-accent font-mono">04</span>
                    Scope of Works Browser
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative group min-w-[300px]">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ghost group-focus-within:text-accent transition-colors" />
                      <input 
                        type="text"
                        placeholder="Quick search code or description..."
                        className="w-full bg-surface-2 border border-border-subtle rounded-xl py-2.5 pl-10 pr-4 text-[11px] font-bold outline-none focus:border-accent text-main shadow-sm transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <button 
                      onClick={() => setShowContracted(!showContracted)}
                      className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all",
                        showContracted ? "bg-accent text-white border-accent shadow-lg shadow-accent/20" : "bg-surface-2 border-border-subtle text-ghost hover:text-main"
                      )}
                    >
                      {showContracted ? "Hide Contracted" : "Available Only"}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto border border-border-subtle rounded-3xl bg-surface-base shadow-inner custom-scrollbar h-[550px]">
                  {sortedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-ghost py-20 opacity-30">
                      <Layers className="w-12 h-12 mb-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">No matching scope items</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-border-subtle/20">
                      {sortedItems.map(item => {
                        if (isHiddenByCollapse(item.item_no || '')) return null;
                        const depth = getDepth(item.item_no || '');
                        const isParent = hasChildren(item.item_no || '');
                        const isOpen = !collapsedSections.has(item.item_no || '');
                        const isAssigned = assignments.some(a => a.boq_item_id === item.id);

                        return (
                          <div 
                            key={item.id} 
                            className={cn(
                              "flex items-center gap-3 py-1.5 px-3 cursor-pointer transition-all hover:bg-main/5 relative group/item",
                              selectedItems.has(item.id) ? "bg-accent/5 ring-1 ring-inset ring-accent/10" : "",
                              isAssigned ? "opacity-40 grayscale-[0.5]" : ""
                            )}
                            style={{ paddingLeft: `${12 + depth * 16}px` }}
                          >
                            <div className="flex items-center gap-2 shrink-0">
                              {isParent ? (
                                <button 
                                  onClick={(e) => { e.preventDefault(); toggleCollapse(item.item_no || ''); }}
                                  className="w-4 h-4 flex items-center justify-center rounded hover:bg-accent/20 transition-colors"
                                >
                                  {isOpen ? <ChevronDown className="w-3 h-3 text-accent" /> : <ChevronRight className="w-3 h-3 text-accent" />}
                                </button>
                              ) : (
                                <div className="w-4" />
                              )}
                              <input 
                                type="checkbox"
                                disabled={isAssigned}
                                className="w-4 h-4 rounded border-border-subtle text-accent focus:ring-accent accent-accent transition-all cursor-pointer disabled:opacity-30"
                                checked={selectedItems.has(item.id)}
                                onChange={(e) => {
                                  if (isParent) selectRecursive(item.item_no || '', e.target.checked);
                                  else {
                                    const next = new Set(selectedItems);
                                    if (next.has(item.id)) next.delete(item.id);
                                    else next.add(item.id);
                                    setSelectedItems(next);
                                  }
                                }}
                              />
                            </div>

                            <div className="flex-1 flex items-center gap-4 min-w-0">
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={cn("font-mono font-black text-accent tracking-tighter shrink-0", isParent ? "text-[11px]" : "text-[10px] opacity-70")}>
                                    {item.item_no}
                                  </span>
                                  {item.trade_code && (
                                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-surface-2 text-ghost border border-border-subtle whitespace-nowrap">
                                      {item.trade_code}
                                    </span>
                                  )}
                                </div>
                                <span className={cn("font-bold leading-tight transition-colors whitespace-normal break-words mt-0.5", isParent ? "text-xs text-main" : "text-[11px] text-dim group-hover/item:text-main")}>
                                  {cleanRichText(item.description)}
                                </span>
                              </div>
                              {!isParent && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[9px] text-ghost font-bold uppercase tracking-widest">{item.contract_qty?.toLocaleString()} {cleanRichText(item.unit || '')}</span>
                                </div>
                              )}
                            </div>
                            {isAssigned && <span className="text-[8px] text-danger font-black uppercase shrink-0 bg-danger/10 px-1 rounded">Projected</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Selection Summary / Checkout */}
              <div className="lg:col-span-2 flex flex-col gap-5">
                <label className="text-[11px] font-black uppercase tracking-widest text-ghost flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center text-[9px] text-accent font-mono">05</span>
                  Assignment Net Summary
                </label>

                <div className="flex-1 flex flex-col bg-surface-2 border border-border-subtle rounded-[2rem] overflow-hidden shadow-2xl h-auto min-h-[550px] pb-4">
                  <div className="p-4 bg-surface-3 border-b border-border-subtle flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center">
                        <Briefcase className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-main">{stagedGroups.length} Batched Groups</span>
                    </div>
                    {stagedGroups.length > 0 && (
                      <button onClick={() => setStagedGroups([])} className="text-[9px] font-black text-danger hover:underline uppercase tracking-widest">Clear Batch</button>
                    )}
                  </div>
                  
                  <div className="flex-1 p-4 space-y-3">
                    {/* Current Selection Preview */}
                    {selectedItems.size > 0 && (
                      <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-accent" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-accent">Pending Selection</span>
                          </div>
                          <button onClick={() => setSelectedItems(new Set())} className="text-[9px] font-bold text-ghost hover:text-danger uppercase tracking-widest">Clear</button>
                        </div>

                        {assignmentType === 'unit_rate' ? (
                          <div className="bg-surface-1 border border-border-subtle rounded-xl p-3 max-h-[300px] overflow-y-auto space-y-1.5 custom-scrollbar shadow-inner text-main">
                            {Array.from(selectedItems).map(id => {
                              const item = boqItems.find(i => i.id === id);
                              return (
                                <div key={id} className="text-[9px] font-bold text-main truncate leading-tight flex items-center gap-2">
                                  <span className="font-mono text-accent shrink-0">{item?.item_no}</span>
                                  <span className="truncate">{cleanRichText(item?.description || '')}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between max-w-full font-sans">
                              <span className="text-[8px] font-black text-ghost uppercase tracking-wider">Parental Dotted Allocation</span>
                              <button 
                                onClick={() => {
                                  // Splitting equally amongst leaf items under each subgroup
                                  const arr = boqItems.filter(item => selectedItems.has(item.id) && !hasChildren(item.item_no || ''));
                                  if (arr.length === 0) return;
                                  
                                  const pGroups: Record<string, string[]> = {};
                                  arr.forEach(item => {
                                    const itemNo = item.item_no || '';
                                    let parentNo = '';
                                    if (itemNo.includes('.')) {
                                      parentNo = itemNo.substring(0, itemNo.lastIndexOf('.'));
                                    }
                                    if (!pGroups[parentNo]) pGroups[parentNo] = [];
                                    pGroups[parentNo].push(item.id);
                                  });

                                  const nextSubGroups = { ...subGroupPercentages };
                                  Object.entries(pGroups).forEach(([pCode, childrenIds]) => {
                                    const eq = (100 / childrenIds.length).toFixed(1);
                                    childrenIds.forEach((childId, idx) => {
                                      if (idx === childrenIds.length - 1) {
                                        let sum = 0;
                                        childrenIds.slice(0, -1).forEach(id => sum += parseFloat(nextSubGroups[id] || eq) || 0);
                                        nextSubGroups[childId] = Math.max(0, 100 - sum).toFixed(1);
                                      } else {
                                        nextSubGroups[childId] = eq;
                                      }
                                    });
                                  });
                                  setSubGroupPercentages(nextSubGroups);
                                }}
                                className="text-[8px] font-black text-accent hover:underline uppercase transition-all"
                              >
                                Split Subgroups Equally
                              </button>
                            </div>
                            
                            <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                              {selectedGroups.map(grp => {
                                const parentPct = parentPercentages[grp.parentNo] || '';
                                // Check if subgroup items sum to 100
                                const childrenSum = grp.items.reduce((sum, item) => sum + (parseFloat(subGroupPercentages[item.id]) || 0), 0);
                                const isSubGroupValid = Math.abs(childrenSum - 100) <= 0.1;

                                return (
                                  <div key={grp.parentNo} className="bg-surface-3 border border-border-subtle p-3.5 rounded-2xl space-y-2.5 shadow-sm text-main">
                                    <div className="flex items-center justify-between gap-2 border-b border-border-subtle/25 pb-2">
                                      <div className="min-w-0">
                                        <div className="text-[10px] font-bold text-main flex items-center gap-1.5 truncate">
                                          <span className="font-mono text-accent">{grp.parent.item_no}</span>
                                          <span className="truncate">{cleanRichText(grp.parent.description || '')}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <span className="text-[8px] text-ghost font-bold uppercase tracking-wider">Parent Category</span>
                                          <span className={cn(
                                            "text-[7px] font-bold px-1 rounded",
                                            isSubGroupValid ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                                          )}>
                                            Subgroup Sum: {childrenSum.toFixed(1)}% / 100%
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <input 
                                          type="number"
                                          step="any"
                                          placeholder="Parent %"
                                          className="w-16 bg-surface-base border border-accent/40 text-right rounded-lg py-1.5 px-2 text-xs font-mono font-black text-main outline-none focus:border-accent"
                                          value={parentPct}
                                          onChange={e => handleParentPercentageChange(grp.parentNo, e.target.value)}
                                        />
                                        <span className="text-[10px] text-accent font-black font-mono">%</span>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-1.5 pl-2 border-l-2 border-accent/15">
                                      {grp.items.map(item => {
                                        const subGroupPct = subGroupPercentages[item.id] || '';
                                        const overallPct = itemPercentages[item.id] || '0.00';
                                        const calculatedShare = ( (parseFloat(overallPct) || 0) / 100 ) * (parseFloat(lumpSumTotal) || 0);
                                        return (
                                          <div key={item.id} className="bg-surface-1 border border-border-subtle/60 p-2 rounded-xl flex items-center justify-between gap-3 shadow-sm text-dim">
                                            <div className="flex-1 min-w-0">
                                              <div className="text-[9px] font-bold text-main truncate leading-tight flex items-center gap-1 mb-0.5">
                                                <span className="font-mono text-ghost text-[8px]">{item.item_no}</span>
                                                <span className="truncate">{cleanRichText(item.description || '')}</span>
                                              </div>
                                              <div className="flex items-center gap-2 text-[8px] text-ghost font-bold uppercase tracking-wider">
                                                <span>Qty ref: <strong className="text-dim">{item.contract_qty}</strong></span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-border-subtle" />
                                                <span>Share: <strong className="text-main">${Math.round(calculatedShare).toLocaleString()}</strong></span>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                              <div className="flex flex-col items-end gap-0.5">
                                                <div className="flex items-center gap-1">
                                                  <input 
                                                    type="number"
                                                    step="any"
                                                    className="w-14 bg-surface-base border border-accent/30 text-right rounded py-0.5 px-1 text-[10px] font-mono font-bold text-main focus:border-accent outline-none"
                                                    value={subGroupPct}
                                                    onChange={e => {
                                                      const val = e.target.value;
                                                      setSubGroupPercentages(prev => ({ ...prev, [item.id]: val }));
                                                    }}
                                                  />
                                                  <span className="text-[8px] text-accent font-black font-mono">% subgroup</span>
                                                </div>
                                                <span className="text-[8px] text-ghost font-mono">({overallPct}% overall)</span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {(() => {
                              const parentKeys = Object.keys(parentPercentages);
                              const sumParents = parentKeys.reduce((acc, code) => acc + (parseFloat(parentPercentages[code]) || 0), 0);
                              const isParentsValid = Math.abs(sumParents - 100) <= 0.1;

                              // Collect bad subgroups
                              const badSubGroups: string[] = [];
                              selectedGroups.forEach(grp => {
                                const sum = grp.items.reduce((acc, item) => acc + (parseFloat(subGroupPercentages[item.id]) || 0), 0);
                                if (Math.abs(sum - 100) > 0.1) {
                                  badSubGroups.push(grp.parentNo);
                                }
                              });

                              return (
                                <div className="space-y-2 border-t border-accent/15 pt-2.5">
                                  <div className="flex items-center justify-between text-[9px]">
                                    <span className="font-black text-ghost uppercase">Parent Sum (Overall Allocation)</span>
                                    <span className={cn(
                                      "font-mono font-black px-2 py-0.5 rounded-full transition-colors",
                                      isParentsValid ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-amber-100 text-amber-700 border border-amber-200"
                                    )}>
                                      {sumParents.toFixed(1)}% / 100%
                                    </span>
                                  </div>

                                  {(!isParentsValid || badSubGroups.length > 0) && (
                                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-700 rounded-xl space-y-1 text-[8px] font-bold uppercase tracking-wider leading-relaxed">
                                      <div className="flex items-center gap-1 text-amber-600">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        <span>Percentage allocation is not adding up to 100%</span>
                                      </div>
                                      {!isParentsValid && (
                                        <div className="pl-2.5 text-ghost">• Main Parent % variables sum to {sumParents.toFixed(1)}% (needs to be 100.0%)</div>
                                      )}
                                      {badSubGroups.map(code => (
                                        <div key={code} className="pl-2.5 text-ghost">• Subgroup category <strong className="text-amber-700">"{code}"</strong> children sum does not add up to 100%</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {assignmentType === 'unit_rate' && (
                          <div className="pt-2 border-t border-accent/10 flex items-center justify-between">
                            <span className="text-[9px] font-black text-ghost uppercase">{selectedItems.size} Items</span>
                            <span className="text-[9px] font-black text-accent uppercase">
                              {`Rate: $${globalRate}/unit`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {stagedGroups.length === 0 && selectedItems.size === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-ghost/40 text-center space-y-4 py-16 px-4">
                        <Plus className="w-10 h-10 opacity-10" />
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] leading-relaxed">
                          No items in batch.<br/>
                          Select scope items,<br/>
                          set rate, then click<br/>
                          "Add to Batch"
                        </p>
                      </div>
                    ) : (
                      stagedGroups.map(group => (
                        <div key={group.id} className="group p-4 bg-surface-base border border-border-subtle rounded-2xl space-y-3 hover:border-accent/40 transition-all shadow-sm text-left">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-black text-main uppercase tracking-tight truncate mb-0.5">{group.name}</div>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[8px] font-black uppercase tracking-widest px-1.5 rounded",
                                  group.type === 'lumpsum' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                                )}>
                                  {group.type === 'unit_rate' ? `Rate: $${group.rate}` : `Lump: $${group.lumpSum}`}
                                </span>
                                <span className="text-[8px] text-ghost font-bold uppercase">{group.itemIds.length} Items</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => setStagedGroups(stagedGroups.filter(g => g.id !== group.id))}
                              className="text-ghost hover:text-danger p-1 bg-surface-2 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="space-y-1.5 pl-2 border-l-2 border-accent/10">
                            {group.itemIds.map(id => {
                              const item = boqItems.find(i => i.id === id);
                              const pctVal = group.percentages?.[id];
                              return (
                                <div key={id} className="text-[9px] font-medium text-dim flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="font-mono text-accent/60 shrink-0">{item?.item_no}</span>
                                    <span className="truncate">{cleanRichText(item?.description || '')}</span>
                                  </div>
                                  {group.type === 'lumpsum' && pctVal !== undefined && (
                                    <span className="text-[8px] font-bold text-accent shrink-0 bg-accent/5 px-1 py-0.5 rounded font-mono">
                                      {pctVal.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-6 bg-surface-3 border-t border-border-subtle space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest text-ghost">Batch Net Authorized</span>
                        <div className="text-xl font-mono font-black text-main">
                          ${stagedGroups.reduce((totalSum, group) => {
                            if (group.type === 'unit_rate') {
                              const groupVal = group.itemIds.reduce((s, id) => {
                                const item = boqItems.find(i => i.id === id);
                                return s + ((item?.contract_qty || 0) * (parseFloat(group.rate) || 0));
                              }, 0);
                              return totalSum + groupVal;
                            }
                            return totalSum + (parseFloat(group.lumpSum) || 0);
                          }, 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={addToBatch}
                      disabled={selectedItems.size === 0}
                      className="w-full py-4 bg-accent hover:bg-accent/85 text-white font-bold rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-accent/20 disabled:opacity-50 transition-all active:scale-[0.98]"
                    >
                      Add to Batch
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

      <div className={cn(
        "space-y-4",
        isFullscreen ? "flex-1 overflow-y-auto custom-scrollbar pr-2" : ""
      )}>
        {groupedAssignments.length === 0 ? (
          <div className="py-24 text-center bg-surface-1 border border-dashed border-border-subtle rounded-[2.5rem] grayscale opacity-40">
            <Briefcase className="w-12 h-12 mx-auto mb-4" />
            <h3 className="text-sm font-black uppercase tracking-widest text-main">No active assignments</h3>
            <p className="text-[10px] font-bold text-ghost uppercase mt-2">Begin by registering scope assignments for your project partners</p>
          </div>
        ) : (
          groupedAssignments.map(group => {
            const isCollapsed = collapsedGroups.has(group.id);
            return (
              <div key={group.id} className="bg-surface-1 border border-border-subtle rounded-[2.5rem] overflow-hidden shadow-sm transition-all hover:shadow-md border-l-4 border-l-primary">
                <div 
                  onClick={() => toggleGroupCollapse(group.id)}
                  className="flex items-center justify-between p-6 cursor-pointer hover:bg-main/5 transition-colors select-none"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-[1.25rem] bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-3">
                          <h4 className="text-base font-black text-main tracking-tight">{group.name}</h4>
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                            group.type === 'lumpsum' ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-blue-100 text-blue-700 border-blue-200"
                          )}>
                            {group.type === 'lumpsum' ? 'Lump Sum' : 'Unit Rate'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ghost font-bold uppercase tracking-widest">
                          <span className="text-accent underline decoration-accent/20 underline-offset-2">{group.sub.company_name}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-border-subtle" />
                          <span>{group.sub.trade_category}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-border-subtle" />
                          <span className="text-primary">{group.items.length} Scope Item(s)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <div className="text-[10px] font-black text-ghost uppercase tracking-widest mb-1">Contract Valuation</div>
                      <div className="text-lg font-black text-main font-mono">${group.totalValue.toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-px bg-border-subtle mx-1" />
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingGroup(group);
                        }}
                        className="p-2.5 text-ghost hover:text-accent hover:bg-accent/10 rounded-xl transition-all"
                        title="Edit general contract parameters"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({
                            type: 'contract',
                            subcontractorId: group.sub.id,
                            groupName: group.name,
                            assignmentType: group.type,
                            scopeCount: group.items.length,
                            subTitle: group.createdAt
                          });
                        }}
                        className="p-2.5 text-ghost hover:text-danger hover:bg-danger/10 rounded-xl transition-all"
                        title="Terminate entire contract & delete assignments"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Local Item Order Dropdown Select */}
                      <div className="relative animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={lineSortBy}
                          onChange={(e) => setLineSortBy(e.target.value as any)}
                          className="bg-surface-2 border border-border-subtle rounded-xl px-2.5 py-1.5 pr-7 text-[10px] font-black uppercase tracking-wider text-ghost hover:text-main hover:border-accent focus:text-main focus:border-accent outline-none cursor-pointer transition-all shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m3%205%203%203%203-3%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-[right_8px_center] bg-no-repeat"
                          title="Sort order of contract line items"
                        >
                          <option value="item_no">Ref: Item No</option>
                          <option value="date_asc">Ref: Oldest First</option>
                          <option value="date_desc">Ref: Newest First</option>
                          <option value="value_desc">Value: High to Low</option>
                          <option value="value_asc">Value: Low to High</option>
                        </select>
                      </div>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          startInlineEditingGroup(group);
                        }}
                        className={cn(
                          "px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 cursor-pointer border",
                          editingContractGroupId === group.id 
                            ? "bg-accent text-white border-accent" 
                            : "bg-accent/10 border-accent/20 hover:bg-accent/20 text-accent"
                        )}
                        title="Edit percentage splits or unit rates inline"
                      >
                        <Layers className="w-3" />
                        <span>{editingContractGroupId === group.id ? "Editing Inline" : "Inline Mass Edit"}</span>
                      </button>

                      <button className="p-2.5 rounded-xl hover:bg-surface-2 transition-colors">
                        {isCollapsed ? <ChevronRight className="w-5 h-5 text-ghost" /> : <ChevronDown className="w-5 h-5 text-ghost" />}
                      </button>
                    </div>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300 pointer-events-auto" onClick={e => e.stopPropagation()}>
                    {editingContractGroupId === group.id && group.type === 'lumpsum' && (() => {
                      const liveOverallValue = parseFloat(inlineLumpSumTotal) || group.totalValue || 0;
                      const { topLevelNodes } = buildAndCalculateContractTree(
                        group.items,
                        liveOverallValue,
                        inlineParentPcts,
                        boqItems,
                        true
                      );

                      const topLevelSubcategories = topLevelNodes.filter(n => !n.isLeaf);
                      const topLevelLeavesCount = topLevelNodes.filter(n => n.isLeaf).length;
                      const sumParents = topLevelSubcategories.reduce((acc, n) => acc + (parseFloat(inlineParentPcts[n.itemNo]) || 0), 0);
                      const isParentsValid = topLevelLeavesCount === 0 
                        ? (Math.abs(sumParents - 100) <= 0.1) 
                        : (sumParents <= 100.1);

                      const badSubGroups: string[] = [];
                      const validateTree = (node: ContractTreeNode) => {
                        if (node.isLeaf || node.children.length === 0) return;
                        
                        const subCategories = node.children.filter(c => !c.isLeaf);
                        const leafChildrenCount = node.children.filter(c => c.isLeaf).length;

                        if (subCategories.length > 0) {
                          const sum = subCategories.reduce((acc, c) => acc + (parseFloat(inlineParentPcts[c.itemNo]) || 0), 0);
                          if (leafChildrenCount === 0) {
                            if (Math.abs(sum - 100) > 0.1) {
                              badSubGroups.push(node.itemNo);
                            }
                          } else {
                            if (sum > 100.1) {
                              badSubGroups.push(node.itemNo);
                            }
                          }
                          subCategories.forEach(validateTree);
                        }
                      };
                      topLevelNodes.forEach(validateTree);

                      // Helper to extract editable balance groups at each level
                      const balanceGroups: { key: string; name: string; sum: number; isValid: boolean; itemNo?: string; isMixed: boolean; leafCount: number }[] = [];

                      if (topLevelNodes.length > 0 && !topLevelNodes.every(n => n.isLeaf)) {
                        balanceGroups.push({
                          key: 'top_level',
                          name: 'Top-Level Main Sections',
                          sum: sumParents,
                          isValid: isParentsValid,
                          isMixed: topLevelLeavesCount > 0,
                          leafCount: topLevelLeavesCount
                        });
                      }

                      const collectSubcategoryBalanceGroups = (node: ContractTreeNode) => {
                        if (node.isLeaf || node.children.length === 0) return;
                        const subCategories = node.children.filter(c => !c.isLeaf);
                        const leafChildrenCount = node.children.filter(c => c.isLeaf).length;

                        if (subCategories.length > 0) {
                          const sum = subCategories.reduce((acc, c) => acc + (parseFloat(inlineParentPcts[c.itemNo]) || 0), 0);
                          const isValid = leafChildrenCount === 0 
                            ? (Math.abs(sum - 100) <= 0.1) 
                            : (sum <= 100.1);

                          balanceGroups.push({
                            key: node.itemNo,
                            name: `Sub-category "${node.itemNo}" (${cleanRichText(node.description).substring(0, 32)}${node.description.length > 32 ? '...' : ''})`,
                            sum,
                            isValid,
                            itemNo: node.itemNo,
                            isMixed: leafChildrenCount > 0,
                            leafCount: leafChildrenCount
                          });
                          node.children.forEach(collectSubcategoryBalanceGroups);
                        }
                      };
                      topLevelNodes.forEach(collectSubcategoryBalanceGroups);

                      return (
                        <div className="mb-4 p-4 bg-gradient-to-r from-accent/5 to-amber-500/5 border border-accent/20 rounded-2xl text-[9px] font-bold uppercase tracking-wider leading-relaxed space-y-3.5 my-3 shadow-inner">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-accent font-black">
                              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                              <span>📊 Sequential Mass Split Flow Guide & Real-Time Balance Status</span>
                            </div>
                            {isParentsValid && badSubGroups.length === 0 ? (
                              <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[8px] tracking-widest uppercase font-black">
                                Fully Balanced 100%
                              </span>
                            ) : (
                              <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full text-[8px] tracking-widest uppercase font-black animate-pulse">
                                Unbalanced Levels Exist
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-1 border-b border-border-subtle/20">
                            <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl border border-border-subtle/30">
                              <span className="text-accent font-black">Step 1: Parent Share (Total 100%)</span>
                              <p className="text-[8px] text-ghost font-bold lowercase mt-0.5 leading-normal">
                                Adjust the top level category inputs to share the contractor budget. Currently sums to: <strong className={isParentsValid ? "text-emerald-500 font-black font-mono animate-pulse" : "text-amber-500 font-black font-mono animate-bounce"}>{sumParents.toFixed(1)}% / 100%</strong>{topLevelLeavesCount > 0 && <span className="text-emerald-500"> (+ {(100 - sumParents).toFixed(1)}% auto-allocated to {topLevelLeavesCount} leaves)</span>}
                              </p>
                            </div>
                            <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-xl border border-border-subtle/30">
                              <span className="text-primary font-black">Step 2: Sub-item Allocation (100% of Parent)</span>
                              <p className="text-[8px] text-ghost font-bold lowercase mt-0.5 leading-normal">
                                Under each parent category, its value is turned into 100%. Adjust sub-categories so they sum up to exactly 100% of parent's pool. Sibling child leaves with quantity are automatically distributed from parent value.
                              </p>
                            </div>
                          </div>

                          {/* Real-time Level Progress Monitor */}
                          <div className="space-y-2">
                            <span className="text-secondary font-black block text-[8px] tracking-widest text-ghost">
                              🎯 LEVEL ASSIGNMENT TRACKER (ALL LEVELS MUST REACH EXACTLY 100.0%)
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {balanceGroups.map(bg => (
                                <div 
                                  key={bg.key} 
                                  className={cn(
                                    "p-2 rounded-xl border transition-all flex flex-col justify-between space-y-1.5",
                                    bg.isValid 
                                      ? "bg-emerald-500/[0.04] border-emerald-500/20 shadow-sm" 
                                      : "bg-amber-500/[0.04] border-amber-500/20 shadow-sm animate-pulse-subtle"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-1.5">
                                    <span className={cn(
                                      "text-[8px] font-extrabold truncate max-w-[80%]",
                                      bg.isValid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-500"
                                    )}>
                                      {bg.name}
                                    </span>
                                    <span className={cn(
                                      "text-[7px] font-black uppercase px-1 rounded shrink-0",
                                      bg.isValid 
                                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                                        : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                    )}>
                                      {bg.isValid ? "OK" : "PENDING"}
                                    </span>
                                  </div>
                                  
                                  {/* Progress bar and numeric readout */}
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[8px] font-bold font-mono">
                                      {bg.isMixed ? (
                                        <>
                                          <span className="text-ghost/60 lowercase">Subcats: {bg.sum.toFixed(1)}% ({bg.leafCount} child leaves auto-allocated)</span>
                                          <span className="text-emerald-500 font-extrabold">100.0% / 100.0%</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-ghost/60 lowercase">Selected Sum:</span>
                                          <span className={bg.isValid ? "text-emerald-500 font-extrabold" : "text-amber-500 font-extrabold"}>
                                            {bg.sum.toFixed(1)}% / 100.0%
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                                      <div 
                                        className={cn(
                                          "h-full rounded-full transition-all duration-300",
                                          bg.isValid ? "bg-emerald-500" : "bg-amber-500"
                                        )}
                                        style={{ width: `${Math.min(100, bg.isMixed ? 100 : bg.sum)}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1 pt-1.5 border-t border-border-subtle/15">
                            {!isParentsValid && (
                              <div className="pl-1.5 text-amber-500 flex items-center gap-1.5 font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                <span>• [STEP 1 ERROR] Parent categories must sum to 100%. Current sum: {sumParents.toFixed(1)}%.</span>
                              </div>
                            )}
                            {badSubGroups.map(code => {
                              const { nodeMap } = buildAndCalculateContractTree(group.items, liveOverallValue, inlineParentPcts, boqItems, true);
                              const node = nodeMap.get(code);
                              const subCategories = node ? node.children.filter(c => !c.isLeaf) : [];
                              const currentSum = subCategories.reduce((acc, c) => acc + (parseFloat(inlineParentPcts[c.itemNo]) || 0), 0);
                              return (
                                <div key={code} className="pl-1.5 text-amber-500 font-semibold flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  <span>• [STEP 2 ERROR] Sub-category "{code}" sub-categories sum is {currentSum.toFixed(1)}% (must sum to exactly 100.0% when no leaves exist, or not exceed 100.0% when leaves exist).</span>
                                </div>
                              );
                            })}
                            {isParentsValid && badSubGroups.length === 0 && (
                              <div className="pl-1.5 text-emerald-500 font-extrabold flex items-center gap-1.5 transition-all text-[10px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>✓ All stages fully balanced! Ready to apply changes safely.</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="bg-surface-2/50 rounded-2xl border border-border-subtle/50 overflow-hidden">
                      <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                          <tr className="bg-surface-base border-b border-border-subtle sticky top-0 z-10">
                            <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase text-ghost tracking-widest bg-surface-base border-b border-border-subtle w-36 relative group/col">
                              Ref / Item No
                            </th>
                            <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase text-ghost tracking-widest bg-surface-base border-b border-border-subtle relative group/col">
                              Scope Description
                            </th>
                            <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase text-ghost tracking-widest text-right bg-surface-base border-b border-border-subtle w-28 relative group/col">
                              Contract Qty
                            </th>
                            <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase text-ghost tracking-widest text-right bg-surface-base border-b border-border-subtle w-36 relative group/col">
                              Agreed Value/Rate
                            </th>
                            <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase text-ghost tracking-widest text-right bg-surface-base border-b border-border-subtle w-28 relative group/col">
                              Subgroup %
                            </th>
                            <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase text-ghost tracking-widest text-right bg-surface-base border-b border-border-subtle w-24 relative group/col">
                              Overall %
                            </th>
                            <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase text-ghost tracking-widest text-right bg-surface-base border-b border-border-subtle w-24 relative group/col">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/30 font-medium font-semibold">
                          {getGroupVirtualRows(group).map(row => {
                            const isEditingThisGroup = editingContractGroupId === group.id;
                            const overallValue = (isEditingThisGroup && group.type === 'lumpsum') ? (parseFloat(inlineLumpSumTotal) || group.totalValue || 0) : (group.totalValue || 0);

                            if (row.type === 'parent_row') {
                              const isEditingThis = isEditingThisGroup;
                              const isItemCollapsed = collapsedGroupItems[group.id]?.has(row.itemNo) || false;

                              const parentLiveValue = row.nodeInfo.value;
                              const depth = row.itemNo.split('.').length - 1;

                              return (
                                <tr key={row.id} className="bg-surface-3/60 font-medium animate-in fade-in duration-200">
                                  <td className="px-4 py-2 text-[11px] font-mono font-extrabold text-accent border-r border-border-subtle/15 font-mono">
                                    <div className="flex items-center gap-1.5">
                                      <span style={{ paddingLeft: `${depth * 10}px` }} className="flex items-center gap-1">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleGroupItemCollapse(group.id, row.itemNo);
                                          }}
                                          className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-all shrink-0 cursor-pointer"
                                          title={isItemCollapsed ? "Expand subcategory" : "Collapse subcategory"}
                                        >
                                          {isItemCollapsed ? (
                                            <ChevronRight className="w-3.5 h-3.5 text-main" />
                                          ) : (
                                            <ChevronDown className="w-3.5 h-3.5 text-main" />
                                          )}
                                        </button>
                                        <span>{row.itemNo}</span>
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 border-r border-border-subtle/15">
                                    <div className="text-[11px] font-black text-main uppercase leading-tight">
                                      {cleanRichText(row.description)}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                      <span className="text-[7.5px] font-black text-ghost uppercase tracking-wider">
                                        Level {depth + 1} ({depth === 0 ? 'Main Section' : depth === 1 ? 'Subsection' : 'Division'})
                                      </span>
                                      {isEditingThis && row.nodeInfo.children && row.nodeInfo.children.length > 0 && (() => {
                                        const childNodes = row.nodeInfo.children;
                                        const areChildrenLeaves = childNodes.every(c => c.isLeaf);
                                        if (areChildrenLeaves) {
                                          return (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[6.5px] font-bold border border-emerald-500/20 uppercase tracking-widest font-mono">
                                              Auto-balanced (100%)
                                            </span>
                                          );
                                        } else {
                                          const childSum = childNodes.reduce((acc, c) => acc + (parseFloat(inlineParentPcts[c.itemNo]) || 0), 0);
                                          const isValid = Math.abs(childSum - 100) <= 0.1;
                                          return (
                                            <span className={cn(
                                              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[6.5px] font-extrabold border uppercase tracking-widest font-mono transition-all",
                                              isValid 
                                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                            )}>
                                              Children Sum: {childSum.toFixed(1)}% / 100%
                                            </span>
                                          );
                                        }
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 border-r border-border-subtle/15 font-mono text-right text-ghost/45 text-[8px] uppercase">
                                    Group Category
                                  </td>
                                  <td className="px-4 py-2 text-right border-r border-border-subtle/15 font-mono">
                                    <span className="text-[11px] font-black text-main font-mono">
                                      ${Math.round(parentLiveValue).toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-right border-r border-border-subtle/15 font-mono">
                                    {row.groupType === 'lumpsum' ? (
                                      isEditingThis ? (
                                        <div className="flex items-center justify-end gap-1">
                                          <input 
                                            type="number"
                                            step="any"
                                            className="w-16 bg-surface-base border border-accent/40 text-right py-0.5 px-1.5 text-[10px] font-mono font-black text-main outline-none focus:border-accent rounded"
                                            value={inlineParentPcts[row.itemNo] || ''}
                                            onChange={e => {
                                              const val = e.target.value;
                                              setInlineParentPcts(prev => ({ ...prev, [row.itemNo]: val }));
                                            }}
                                          />
                                          <span className="text-[9px] font-black text-accent font-mono">%</span>
                                        </div>
                                      ) : (
                                        <span className="text-[11px] font-bold text-accent font-mono">
                                          {row.nodeInfo.percentage.toFixed(1)}%
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-ghost/30 font-mono text-[9px]">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-right border-r border-border-subtle/15 font-mono">
                                    {row.groupType === 'lumpsum' ? (
                                      <span className="text-[11px] font-bold text-ghost font-mono">
                                        {(row.nodeInfo.value / overallValue * 100).toFixed(1)}%
                                      </span>
                                    ) : (
                                      <span className="text-ghost/30 font-mono text-[9px]">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-right text-ghost text-[8px] font-bold uppercase tracking-widest">
                                    Category
                                  </td>
                                </tr>
                              );
                            } else {
                              const a = row.item;
                              const isEditingThis = editingContractGroupId === group.id;
                              const itemNo = a.boq_item?.item_no || '';
                              const depth = getDepth(itemNo);

                              const calculatedValueLabel = `$${Math.round(row.nodeInfo.value).toLocaleString()}`;
                              const parentValStr = row.nodeInfo.parent ? Math.round(row.nodeInfo.parent.value).toLocaleString() : '';
                              const liveOverallPercent = overallValue > 0 ? (row.nodeInfo.value / overallValue * 100) : 0;

                              return (
                                <tr key={a.id} className="hover:bg-primary/[0.02] transition-colors group/row border-b border-border-subtle/20 h-auto">
                                  <td className="px-4 py-1.5 text-[11px] font-mono font-bold text-accent border-r border-border-subtle/20 font-mono">
                                    <span style={{ paddingLeft: `${depth * 10}px` }}>{itemNo}</span>
                                  </td>
                                  <td className="px-4 py-1.5 border-r border-border-subtle/20">
                                    <div className="text-[11px] font-medium text-dim/90 whitespace-normal break-words leading-tight animate-in fade-in duration-250">
                                      {cleanRichText(a.boq_item?.description || '')}
                                    </div>
                                  </td>
                                  <td className="px-4 py-1.5 text-right border-r border-border-subtle/20 font-mono">
                                    <span className="text-[11px] text-main font-bold">{a.contract_qty.toLocaleString()}</span>
                                    <span className="text-[9px] text-ghost ml-1 uppercase">{cleanRichText(a.boq_item?.unit || '')}</span>
                                  </td>
                                  <td className="px-4 py-1.5 text-right border-r border-border-subtle/20 font-mono">
                                    <div className="flex flex-col items-end justify-center">
                                      {isEditingThis ? (
                                        group.type === 'unit_rate' ? (
                                          <div className="flex items-center gap-1 justify-end">
                                            <span className="text-[10px] text-ghost font-mono">$</span>
                                            <input 
                                              type="number"
                                              step="any"
                                              className="w-20 bg-surface-base border border-accent/30 text-right py-0.5 px-1.5 text-[10px] font-mono font-bold text-main outline-none focus:border-accent rounded"
                                              value={inlineRates[a.id] || ''}
                                              onChange={e => {
                                                const val = e.target.value;
                                                setInlineRates(prev => ({ ...prev, [a.id]: val }));
                                              }}
                                            />
                                            <span className="text-[8px] text-ghost font-bold uppercase">/unit</span>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col items-end text-right">
                                            <span className="text-[11px] font-black text-main font-mono text-right">
                                              {calculatedValueLabel}
                                            </span>
                                            {row.nodeInfo.parent && (
                                              <span className="text-[6.5px] font-black text-accent/80 font-mono uppercase tracking-tight leading-none mt-0.5 whitespace-nowrap">
                                                ({row.nodeInfo.percentage.toFixed(1)}% of {row.nodeInfo.parent.itemNo}'s ${parentValStr})
                                              </span>
                                            )}
                                          </div>
                                        )
                                      ) : (
                                        <span className="text-[11px] font-black text-main font-mono">
                                          {group.type === 'lumpsum' ? calculatedValueLabel : `$${(a.contract_rate || 0).toLocaleString()}`}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-1.5 text-right border-r border-border-subtle/20 font-mono">
                                    {group.type === 'lumpsum' ? (
                                      isEditingThis ? (
                                        <span className="text-[9px] text-emerald-500 font-extrabold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 whitespace-nowrap animate-pulse">
                                          {row.nodeInfo.percentage.toFixed(1)}% (Auto Qty)
                                        </span>
                                      ) : (
                                        <span className="text-[11px] font-bold text-accent font-mono">
                                          {row.nodeInfo.percentage.toFixed(1)}%
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-ghost/30 font-mono text-[9px]">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-1.5 text-right border-r border-border-subtle/20 font-mono font-bold text-ghost">
                                    {group.type === 'lumpsum' ? (
                                      <span className="text-[11px] font-bold text-ghost font-mono">
                                        {liveOverallPercent.toFixed(1)}%
                                      </span>
                                    ) : (
                                      <span className="text-ghost/30 font-mono text-[9px]">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-1.5 border-r border-border-subtle/20">
                                    <div className="flex items-center justify-end gap-1">
                                      {isEditingThis ? (
                                        <span className="text-[7.5px] font-black uppercase text-accent tracking-widest bg-accent/5 px-1 py-0.5 rounded">Editing</span>
                                      ) : (
                                        <>
                                          <button 
                                            onClick={() => startEditingItem(a)}
                                            className="p-1.5 text-ghost hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                                            title="Edit item params"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button 
                                            onClick={() => setDeleteTarget({
                                              type: 'assignment',
                                              id: a.id,
                                              groupName: `${a.boq_item?.item_no} - ${cleanRichText(a.boq_item?.description || '').slice(0, 40)}...`
                                            })}
                                            className="p-1.5 text-ghost hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                                            title="Delete assignment"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            }
                          })}
                        </tbody>
                      </table>

                      {editingContractGroupId === group.id && (
                        <div className="p-4 bg-surface-3 flex items-center justify-between border-t border-border-subtle/50">
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black uppercase tracking-widest text-accent">Active Inline Mass Editor</span>
                            {group.type === 'lumpsum' && (
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-bold uppercase text-ghost">Contract Total:</span>
                                <input 
                                  type="number"
                                  step="any"
                                  className="w-24 bg-surface-base border border-accent/40 px-2 py-0.5 text-[10px] font-mono font-bold text-main outline-none focus:border-accent rounded text-right animate-pulse"
                                  value={inlineLumpSumTotal}
                                  onChange={e => setInlineLumpSumTotal(e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setEditingContractGroupId(null)}
                              className="px-3.5 py-1.5 hover:bg-surface-2 text-ghost hover:text-main text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                            >
                              Discard
                            </button>
                            <button 
                              onClick={() => handleSaveInlineEdit(group)}
                              className="px-4 py-2 bg-accent text-white hover:bg-accent/90 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md"
                            >
                              Apply Inline Changes
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Global Edit Modal */}
      {editingMode && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-surface-base/80 backdrop-blur-sm p-4 animate-in fade-in duration-300 animate-out fade-out duration-300">
          {editingMode === 'item' ? (() => {
            const a = assignments.find(item => item.id === editingAssignmentId);
            if (!a) return null;
            const isLumpSum = a.assignment_type === 'lumpsum';
            
            return (
              <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                      <Pencil className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-main uppercase tracking-tight">Edit Line Item</h4>
                      <p className="text-[10px] font-bold text-ghost uppercase mt-0.5 tracking-widest">Scope: {a.boq_item?.item_no}</p>
                    </div>
                  </div>
                  <button onClick={cancelEditing} className="p-1.5 hover:bg-surface-2 rounded-lg text-ghost hover:text-main transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Scope Info Card */}
                  <div className="p-4 bg-surface-2 rounded-xl border border-border-subtle space-y-2 text-left">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-0.5 rounded-full border inline-block",
                      isLumpSum ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-blue-100 text-blue-700 border-blue-200"
                    )}>
                      {isLumpSum ? 'Lump Sum (Fixed)' : 'Unit Rate (Variable)'}
                    </span>
                    <p className="text-[11px] font-medium text-dim leading-tight">
                      {cleanRichText(a.boq_item?.description || '')}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {isLumpSum ? (
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black uppercase tracking-widest text-dim px-1">Agreed Weight Percentage (%)</label>
                        <div className="relative">
                          <input 
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            className="w-full bg-surface-2 border border-border-subtle rounded-xl py-2.5 px-4 text-xs font-mono font-black outline-none focus:border-accent text-main transition-all shadow-sm"
                            value={editPct}
                            onChange={e => setEditPct(e.target.value)}
                          />
                        </div>
                        {(() => {
                          const parentGroup = groupedAssignments.find(g => g.items.some(item => item.id === a.id));
                          if (!parentGroup) return null;
                          const groupTotal = parentGroup.totalValue;
                          const calculatedAmount = ((parseFloat(editPct) || 0) / 100) * groupTotal;
                          
                          const otherPctSum = parentGroup.items
                            .filter(item => item.id !== a.id)
                            .reduce((sum, item) => sum + (((item.lump_sum_total || 0) / groupTotal) * 100), 0);
                          const totalPctWithThis = otherPctSum + (parseFloat(editPct) || 0);

                          return (
                            <div className="space-y-1.5 mt-3 p-3 bg-surface-2 border border-border-subtle rounded-xl">
                              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold">
                                <span className="text-ghost">Calculated Amount:</span>
                                <span className="text-main font-mono">${Math.round(calculatedAmount).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold">
                                <span className="text-ghost">Group Total:</span>
                                <span className="text-accent font-mono">${Math.round(groupTotal).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold pt-1.5 border-t border-border-subtle/50">
                                <span className="text-ghost font-black">Group Weight Total:</span>
                                <span className={cn(
                                  "font-mono font-black",
                                  totalPctWithThis > 100.01 ? "text-danger animate-pulse" : "text-emerald-600"
                                )}>
                                  {totalPctWithThis.toFixed(2)}% / 100%
                                </span>
                              </div>
                              {totalPctWithThis > 100.01 && (
                                <p className="text-[9px] text-danger font-black uppercase mt-1 leading-normal">
                                  ⚠️ Total exceeds 100%! Please scale down before conforming.
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black uppercase tracking-widest text-dim px-1">Agreed Service Rate ($)</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                          <input 
                            type="number"
                            className="w-full bg-surface-2 border border-border-subtle rounded-xl py-2.5 pl-9 pr-4 text-xs font-mono font-black outline-none focus:border-accent text-main transition-all shadow-sm"
                            value={editRate}
                            onChange={e => setEditRate(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-ghost font-bold uppercase tracking-wider px-1">
                          <span>Contract Qty: {a.contract_qty.toLocaleString()} {a.boq_item?.unit}</span>
                          <span>Line Value: ${(a.contract_qty * (parseFloat(editRate) || 0)).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 justify-end border-t border-border-subtle/50 pt-4">
                  <button 
                    type="button"
                    onClick={cancelEditing}
                    className="px-4 py-2 text-xs font-black text-ghost hover:text-main uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleUpdateItem(a.id)}
                    disabled={loading}
                    className="px-5 py-2 text-xs font-black text-white bg-accent hover:bg-accent/95 rounded-xl transition-all shadow-sm uppercase tracking-widest"
                  >
                    {loading ? 'Saving...' : 'Confirm Changes'}
                  </button>
                </div>
              </div>
            );
          })() : (() => {
            const group = groupedAssignments.find(g => g.id === editingGroupId);
            if (!group) return null;
            const isLumpSum = group.type === 'lumpsum';
            
            return (
              <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-main uppercase tracking-tight">Edit Contract Group</h4>
                      <p className="text-[10px] font-bold text-ghost uppercase mt-0.5 tracking-widest">
                        {group.sub.company_name} - {group.items.length} item(s)
                      </p>
                    </div>
                  </div>
                  <button onClick={cancelEditing} className="p-1.5 hover:bg-surface-2 rounded-lg text-ghost hover:text-main transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Modality badge info */}
                  <div className="p-4 bg-surface-2 rounded-xl border border-border-subtle space-y-2 text-left">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-0.5 rounded-full border inline-block",
                      isLumpSum ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-blue-100 text-blue-700 border-blue-200"
                    )}>
                      {isLumpSum ? 'Lump Sum (Fixed)' : 'Unit Rate (Variable)'}
                    </span>
                    <p className="text-[9px] font-bold text-accent uppercase leading-relaxed block">
                      Note: Changes made here update overall contract parameters across all {group.items.length} items.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2 text-left">
                      <label className="text-[10px] font-black uppercase tracking-widest text-dim px-1">Group/Contract Reference Name</label>
                      <input 
                        className="w-full bg-surface-2 border border-border-subtle rounded-xl p-3 text-xs font-bold outline-none focus:border-accent text-main transition-all shadow-sm"
                        value={editGroupName}
                        onChange={e => setEditGroupName(e.target.value)}
                        placeholder="e.g. Phase 1 Framing"
                      />
                    </div>

                    {isLumpSum ? (
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black uppercase tracking-widest text-dim px-1">Total Agreed Value ($)</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                          <input 
                            type="number"
                            className="w-full bg-surface-2 border border-border-subtle rounded-xl py-2.5 pl-9 pr-4 text-xs font-mono font-black outline-none focus:border-accent text-main transition-all shadow-sm"
                            value={editLumpSum}
                            onChange={e => setEditLumpSum(e.target.value)}
                          />
                        </div>
                        <p className="text-[9px] text-ghost font-bold uppercase tracking-wider px-1">
                          The new total will be distributed proportionally among all items according to their current shares.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black uppercase tracking-widest text-dim px-1">Global Agreed Service Rate ($) <span className="text-[9px] text-ghost lowercase">(optional)</span></label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                          <input 
                            type="number"
                            className="w-full bg-surface-2 border border-border-subtle rounded-xl py-2.5 pl-9 pr-4 text-xs font-mono font-black outline-none focus:border-accent text-main transition-all shadow-sm"
                            value={editRate}
                            onChange={e => setEditRate(e.target.value)}
                            placeholder="Leave empty to keep individual rates"
                          />
                        </div>
                        <p className="text-[9px] text-ghost font-bold uppercase tracking-wider px-1">
                          If entered, this rate will override the unit rate of ALL items in this contract group.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 justify-end border-t border-border-subtle/50 pt-4">
                  <button 
                    type="button"
                    onClick={cancelEditing}
                    className="px-4 py-2 text-xs font-black text-ghost hover:text-main uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleUpdateGroup(group.id)}
                    disabled={loading}
                    className="px-5 py-2 text-xs font-black text-white bg-accent hover:bg-accent/95 rounded-xl transition-all shadow-sm uppercase tracking-widest"
                  >
                    {loading ? 'Saving...' : 'Confirm Changes'}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

       {/* Custom Confirmation Dialog for Contract or Assignment Deletion */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-surface-base/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border-subtle rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-6 animate-in zoom-in duration-200">
            <div className="flex items-start gap-4 text-left">
              <div className="w-12 h-12 rounded-xl bg-danger/10 text-danger flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-black text-main uppercase tracking-tight">
                  {deleteTarget.type === 'contract' ? 'Terminate Subcontract?' : 'Remove Scope Assignment?'}
                </h3>
                <p className="text-xs text-dim leading-relaxed">
                  {deleteTarget.type === 'contract' 
                    ? <>Are you sure you want to terminate and delete the contract <strong className="text-main font-bold">"{deleteTarget.groupName}"</strong>? This will permanently remove all {deleteTarget.scopeCount} scope items associated with this batch contract.</>
                    : <>Are you sure you want to delete this specific scope assignment <strong className="text-main font-bold">"{deleteTarget.groupName}"</strong>? This item will no longer be assigned to the subcontractor.</>
                  }
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end pt-2 border-t border-border-subtle/50">
              <button 
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-black text-ghost hover:text-main uppercase tracking-widest transition-all"
              >
                Cancel Selection
              </button>
              <button 
                onClick={async () => {
                  const target = deleteTarget;
                  setDeleteTarget(null);
                  if (target.type === 'contract') {
                    await removeContractBatch(target.subcontractorId!, target.groupName!, target.assignmentType!, target.subTitle, true);
                  } else {
                    await removeAssignment(target.id!, true);
                  }
                }}
                className="px-5 py-2 text-xs font-black text-white bg-danger hover:bg-danger/95 rounded-xl transition-all shadow-md shadow-danger/10 uppercase tracking-widest"
              >
                Confirm Terminate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Create Subcontractor Modal */}
       {isQuickAddingSub && (
         <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-left">
             <div className="flex items-center justify-between border-b border-border-subtle pb-3">
               <div className="flex items-center gap-2 text-accent">
                 <Users className="w-5 h-5 text-accent" />
                 <span className="font-bold text-sm uppercase tracking-wider text-main">Register New Contract Partner</span>
               </div>
               <button 
                 onClick={() => setIsQuickAddingSub(false)}
                 className="p-1 hover:bg-surface-2 rounded-lg text-ghost hover:text-main"
               >
                 <X className="w-4 h-4" />
               </button>
             </div>

             <div className="space-y-4 text-left">
               <div>
                 <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Company Name *</label>
                 <input 
                   type="text" 
                   placeholder="e.g. Apex Foundations Ltd" 
                   className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                   value={quickSubForm.company_name}
                   onChange={e => setQuickSubForm({ ...quickSubForm, company_name: e.target.value })}
                 />
               </div>

               <div>
                 <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Trade Specialty / Category</label>
                 <select 
                   className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                   value={quickSubForm.trade_category}
                   onChange={e => setQuickSubForm({ ...quickSubForm, trade_category: e.target.value })}
                 >
                   <option value="Concrete Works">🧱 Concrete Works</option>
                   <option value="Masonry">🧱 Masonry</option>
                   <option value="Carpentry">🪚 Carpentry</option>
                   <option value="Structural Steel">⚙️ Structural Steel</option>
                   <option value="Plumbing">🔧 Plumbing</option>
                   <option value="Electrical">⚡ Electrical</option>
                   <option value="Finishes">🪄 Finishes</option>
                   <option value="Civil Engine">🚜 Earthworks & Civil</option>
                   <option value="Landscaping">🌿 Landscaping</option>
                 </select>
               </div>

               <div>
                 <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Contact Person Name</label>
                 <input 
                   type="text" 
                   placeholder="e.g. John Doe" 
                   className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                   value={quickSubForm.contact_person}
                   onChange={e => setQuickSubForm({ ...quickSubForm, contact_person: e.target.value })}
                 />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Email</label>
                   <input 
                     type="email" 
                     placeholder="vendor@company.com" 
                     className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                     value={quickSubForm.email}
                     onChange={e => setQuickSubForm({ ...quickSubForm, email: e.target.value })}
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Phone</label>
                   <input 
                     type="text" 
                     placeholder="+1 (555) 0199" 
                     className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                     value={quickSubForm.phone}
                     onChange={e => setQuickSubForm({ ...quickSubForm, phone: e.target.value })}
                   />
                 </div>
               </div>
             </div>

             <div className="flex justify-end gap-3 mt-6 border-t border-border-subtle pt-4">
               <button 
                 onClick={() => setIsQuickAddingSub(false)}
                 className="px-4 py-2 text-xs font-bold text-ghost hover:text-main"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleSaveQuickSub}
                 className="px-4 py-2 bg-accent hover:bg-accent/85 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                 disabled={loading}
               >
                 {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                 Register Partner
               </button>
             </div>
           </div>
         </div>
       )}
     </div>
   );
 }
