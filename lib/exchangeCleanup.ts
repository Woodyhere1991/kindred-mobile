import { supabase } from './supabase'

interface CleanupParams {
  itemId: string
  itemTitle: string
  itemType: 'give' | 'need'
  category?: string
  userId: string
  userName?: string
  otherUserId: string | null
  otherUserName?: string
  rating: number
  pointsEarned: number
  proximityVerified?: boolean
  proximityDistanceM?: number | null
}

/** Save a receipt and clean up heavy data after an exchange is completed */
export async function cleanupAfterExchange(params: CleanupParams) {
  const { itemId, itemTitle, itemType, category, userId, userName, otherUserId, otherUserName, rating, pointsEarned, proximityVerified, proximityDistanceM } = params

  const giverId = itemType === 'give' ? userId : otherUserId
  const receiverId = itemType === 'give' ? otherUserId : userId
  const giverName = itemType === 'give' ? (userName || 'Unknown') : (otherUserName || 'Unknown')
  const receiverName = itemType === 'give' ? (otherUserName || 'Unknown') : (userName || 'Unknown')

  // 1. Save receipt
  try {
    await supabase.from('exchange_receipts').insert({
      item_id: itemId,
      item_title: itemTitle,
      item_type: itemType,
      category: category || null,
      giver_id: giverId,
      receiver_id: receiverId,
      giver_name: giverName,
      receiver_name: receiverName,
      rating,
      points_earned: pointsEarned,
      proximity_verified: proximityVerified || false,
      proximity_distance_m: proximityDistanceM ?? null,
    })
  } catch (err) {
    console.error('Failed to save receipt:', err)
  }

  // 2. Delete item photos from storage
  try {
    const { data: photos } = await supabase
      .from('item_photos')
      .select('storage_path')
      .eq('item_id', itemId)
    if (photos && photos.length > 0) {
      const paths = photos.map(p => p.storage_path)
      await supabase.storage.from('item-photos').remove(paths)
      await supabase.from('item_photos').delete().eq('item_id', itemId)
    }
  } catch (err) {
    console.error('Failed to clean up item photos:', err)
  }

  // 3. Archive conversations (mark as completed, keep messages for history)
  try {
    const { data: convos } = await supabase
      .from('conversations')
      .select('id')
      .eq('item_id', itemId)
    if (convos && convos.length > 0) {
      for (const convo of convos) {
        await supabase.from('conversations').update({ archived: true }).eq('id', convo.id)
      }
    }
  } catch (err) {
    console.error('Failed to archive conversations:', err)
  }

  // 4. Delete declined/withdrawn matches (keep accepted one for reference briefly)
  try {
    await supabase
      .from('matches')
      .delete()
      .eq('item_id', itemId)
      .in('status', ['declined', 'withdrawn', 'cancelled'])
  } catch (err) {
    console.error('Failed to clean up old matches:', err)
  }

  // 5. Delete offer photos from storage
  try {
    const { data: offers } = await supabase
      .from('matches')
      .select('id')
      .eq('item_id', itemId)
    if (offers) {
      for (const offer of offers) {
        const { data: offerPhotos } = await supabase
          .from('offer_photos')
          .select('storage_path')
          .eq('match_id', offer.id)
        if (offerPhotos && offerPhotos.length > 0) {
          const paths = offerPhotos.map(p => p.storage_path)
          await supabase.storage.from('offer-photos').remove(paths)
          await supabase.from('offer_photos').delete().eq('match_id', offer.id)
        }
      }
    }
  } catch (err) {
    console.error('Failed to clean up offer photos:', err)
  }
}
