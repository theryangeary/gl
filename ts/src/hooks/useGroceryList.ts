import { useCallback, useEffect, useState } from 'react'
import type { GroceryListEntry, ReorderRequest } from '../types/grocery'

const API_BASE = '/api'

export type GroceryListRepository = {
  entries: GroceryListEntry[],
  loading: boolean,
  createEntry: (description: string, position: number, quantity?: string, notes?: string) => Promise<any>,
  updateEntry: (id: number, updates: Partial<GroceryListEntry>) => Promise<any>,
  deleteEntry: (id: number) => Promise<any>,
  reorderEntries: (id: number, newPosition?: number, newCategoryId?: number) => Promise<any>,
  fetchSuggestions: (query: string) => Promise<string[]>,
  getByLabel: (label: string) => GroceryListEntry | undefined,
}

export function useGroceryList(onError: (e: Error) => void): GroceryListRepository {
  const [entries, setEntries] = useState<GroceryListEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEntries = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/entries`)
      if (response.ok) {
        const data = await response.json()
        setEntries(data)
      } else {
        console.error('API request failed:', response.status, response.statusText)
        const text = await response.text()
        console.error('Response body:', text)
        onError(new Error(`Failed to fetch entries: ${response.status} ${response.statusText}`))
      }
    } catch (error) {
      console.error('Failed to fetch entries:', error)
      onError(error instanceof Error ? error : new Error('Failed to fetch entries'))
    } finally {
      setLoading(false)
    }
  }, [])

  const createEntry = useCallback(async (description: string, position: number, quantity?: string, notes?: string) => {
    try {
      const response = await fetch(`${API_BASE}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, position, quantity, notes })
      })
      if (response.ok) {
        const newEntry = await response.json()
        setEntries(prev => [...prev, newEntry].sort((a, b) => a.position - b.position))
        return newEntry
      }
    } catch (error) {
      console.error('Failed to create entry:', error)
      onError(error instanceof Error ? error : new Error('Failed to create entry'))
    }
  }, [])

  const updateEntry = useCallback(async (id: number, updates: Partial<GroceryListEntry>) => {
    try {
      const response = await fetch(`${API_BASE}/entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      if (response.ok) {
        const updatedEntry = await response.json()
        setEntries(prev => prev.map(entry => entry.id === id ? updatedEntry : entry))
      }
    } catch (error) {
      console.error('Failed to update entry:', error)
      onError(error instanceof Error ? error : new Error('Failed to update entry'))
    }
  }, [])

  const deleteEntry = useCallback(async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/entries/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setEntries(prev => prev.filter(entry => entry.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete entry:', error)
      onError(error instanceof Error ? error : new Error('Failed to delete entry'))
    }
  }, [])

  const reorderEntries = async (id: number, newPosition?: number, newCategoryId?: number) => {
    var request: ReorderRequest = { id };
    if (newPosition) {
      request.new_position = newPosition;
    }
    if (newCategoryId) {
      request.new_category_id = newCategoryId;
    }

    try {
      await fetch(`${API_BASE}/entries/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
    } catch (error) {
      console.error('Failed to reorder entries:', error)
      onError(error instanceof Error ? error : new Error('Failed to reorder entries'))
    }
    fetchEntries()
  }

  const fetchSuggestions = useCallback(async (query: string): Promise<string[]> => {
    if (query.length === 0) {
      return []
    }

    try {
      const response = await fetch(`${API_BASE}/entries/suggestions?query=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        return data
      } else {
        console.error('Failed to fetch suggestions:', response.status, response.statusText)
        return []
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error)
      onError(error instanceof Error ? error : new Error('Failed to fetch suggestions'))
      return []
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const getByLabel = (entryLabel: string) => {
      return entries.find((entry) => getLabel(entry) === entryLabel);
    }

  return {
    entries,
    loading,
    createEntry,
    updateEntry,
    deleteEntry,
    reorderEntries,
    fetchSuggestions,
    getByLabel,
  }
}

export function getLabel(entry: GroceryListEntry): string {
  return `entry-${entry.id}`
}
