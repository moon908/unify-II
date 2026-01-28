'use server'

import { supabase } from '@/lib/supabase/client'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

export async function createWorkspace(formData: FormData, orgId: string) {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')

    const project = formData.get('project') as string
    const color = formData.get('color') as string
    const description = formData.get('description') as string
    const status = formData.get('status') as string || 'active'

    // 1. Create Workspace
    const { data: workspace, error: workspaceError } = await supabase
        .from('Workspace')
        .insert([
            {
                project,
                color,
                description,
                status,
                org_id: orgId,
                created_by: userId
            }
        ])
        .select()
        .single()

    if (workspaceError) {
        console.error('Error creating workspace:', workspaceError)
        return { success: false, error: workspaceError.message }
    }

    // 2. Add creator as member 
    const { error: memberError } = await supabase
        .from('workspace_members')
        .insert([
            {
                workspace_id: workspace.id,
                user_id: userId,
                role: 'Admins'
            }
        ])

    if (memberError) {
        console.error('Error adding creator as member:', memberError)
        // Optionally handle this - we might want to delete the workspace if member addition fails
        // but for now we'll just return the error
        return { success: false, error: memberError.message }
    }

    revalidatePath(`/organisation/${orgId}/dashboard/workspace`)
    return { success: true, data: workspace }
}

export async function getWorkspaces(orgId: string) {
    const { data, error } = await supabase
        .from('Workspace')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching workspaces:', error)
        return { success: false, error: error.message }
    }

    return { success: true, data }
}

export async function deleteWorkspace(workspaceId: string, orgId: string) {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('Workspace')
        .delete()
        .eq('id', workspaceId)
        .eq('created_by', userId) // Security: only creator can delete

    if (error) {
        console.error('Error deleting workspace:', error)
        return { success: false, error: error.message }
    }

    revalidatePath(`/organisation/${orgId}/dashboard/workspace`)
    return { success: true }
}
