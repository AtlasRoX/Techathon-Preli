import { supabase } from '../lib/supabase';
import { Room } from '../lib/types';

export class RoomService {
  static async getRooms(): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching rooms:', error);
      throw error;
    }
    return data || [];
  }
}
