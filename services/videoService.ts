import { supabase } from './supabaseClient';

export interface VideoRecord {
    prompt: string;
    video_url: string;
}

export const videoService = {
    async saveVideo(video: VideoRecord) {
        const { data, error } = await supabase
            .from('videos')
            .insert([video])
            .select()
            .single();

        if (error) {
            console.error('Erro ao salvar vídeo no Supabase:', error);
            throw error;
        }

        return data;
    },

    async listVideos() {
        const { data, error } = await supabase
            .from('videos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao listar vídeos:', error);
            throw error;
        }

        return data;
    }
};
