/**
 * useFriends Hook
 * ================
 * Presentation Layer - React hook for friend management.
 * Replaces all friend-related logic previously in Sidebar.tsx.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Profile } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import * as friendService from '@/services/friendService';
import { FriendWithSubjects, PendingRequest } from '@/services/friendService';

// ============================================================================
// TYPES
// ============================================================================

interface UseFriendsReturn {
    // Data
    friends: FriendWithSubjects[];
    pendingRequests: PendingRequest[];
    suggestions: Profile[];
    searchResults: Profile[];

    // State
    loading: boolean;
    searching: boolean;
    sentRequests: string[]; // IDs of users we've sent requests to

    // Actions
    searchUsers: (query: string) => Promise<void>;
    sendFriendRequest: (friendId: string) => Promise<void>;
    acceptRequest: (requestId: string) => Promise<void>;
    rejectRequest: (requestId: string) => Promise<void>;
    refresh: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFriends(): UseFriendsReturn {
    const { user, profile } = useAuth();

    // Data state
    const [friends, setFriends] = useState<FriendWithSubjects[]>([]);
    const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
    const [suggestions, setSuggestions] = useState<Profile[]>([]);
    const [searchResults, setSearchResults] = useState<Profile[]>([]);

    // UI state
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [sentRequests, setSentRequests] = useState<string[]>([]);

    // ========================================================================
    // DATA FETCHING
    // ========================================================================

    const fetchAllData = useCallback(async () => {
        if (!user) return;

        setLoading(true);

        try {
            // Fetch friends with subjects
            const friendsData = await friendService.getFriendsWithSubjects(user.id);
            setFriends(friendsData);

            // Fetch pending requests (sent TO us)
            const requestsData = await friendService.getPendingRequestsWithProfiles(user.id);
            setPendingRequests(requestsData);

            // Fetch our sent pending requests (sent BY us)
            const sentData = await friendService.getSentPendingRequests(user.id);
            setSentRequests(sentData);

            // Fetch suggestions
            const friendIds = friendsData.map(f => f.id);
            const suggestionsData = await friendService.getSuggestions(
                user.id,
                profile?.grade_level,
                friendIds
            );
            setSuggestions(suggestionsData);
        } catch (error) {
            console.error('[useFriends] Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [user, profile?.grade_level]);

    // Initial fetch
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // ========================================================================
    // ACTIONS
    // ========================================================================

    const searchUsers = async (query: string) => {
        if (!user || !query.trim()) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const results = await friendService.searchUsers(query, user.id);
            setSearchResults(results);
        } finally {
            setSearching(false);
        }
    };

    const sendFriendRequest = async (friendId: string) => {
        if (!user) return;

        console.log('[useFriends] Sending friend request to:', friendId);
        try {
            const result = await friendService.sendOrAcceptFriendRequest(user.id, friendId);
            console.log('[useFriends] Friend request result:', result);

            if (result.success) {
                setSentRequests(prev => [...prev, friendId]);
                // Remove from suggestions
                setSuggestions(prev => prev.filter(s => s.id !== friendId));
                setSearchResults(prev => prev.filter(s => s.id !== friendId));

                if (result.action === 'accepted') {
                    await fetchAllData();
                }
            } else {
                console.warn('[useFriends] Friend request not sent:', result.action);
            }
        } catch (error) {
            console.error('[useFriends] Friend request error:', error);
        }
    };

    const acceptRequest = async (requestId: string) => {
        const success = await friendService.acceptFriendRequest(requestId);
        if (success) {
            // Refresh all data to show new friend
            await fetchAllData();
        }
    };

    const rejectRequest = async (requestId: string) => {
        const success = await friendService.rejectFriendRequest(requestId);
        if (success) {
            setPendingRequests(prev => prev.filter(r => r.id !== requestId));
        }
    };

    return {
        friends,
        pendingRequests,
        suggestions,
        searchResults,
        loading,
        searching,
        sentRequests,
        searchUsers,
        sendFriendRequest,
        acceptRequest,
        rejectRequest,
        refresh: fetchAllData,
    };
}
