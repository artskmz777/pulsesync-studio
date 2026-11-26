import type { TriColorGradient } from '../types/studio';

export const TRI_COLOR_GRADIENTS: readonly TriColorGradient[] = [
  { id: 'cyber-neon', nameTh: 'นีออนไซเบอร์', nameEn: 'Cyber Neon', colors: ['#00F5FF', '#7B2FFF', '#FF00AA'] },
  { id: 'urban-sunset', nameTh: 'อัสดงเมืองกรุง', nameEn: 'Urban Sunset', colors: ['#FF512F', '#DD2476', '#5B247A'] },
  { id: 'arctic-aurora', nameTh: 'แสงเหนืออาร์กติก', nameEn: 'Arctic Aurora', colors: ['#00FFA3', '#00C2FF', '#4D61FC'] },
  { id: 'royal-gold', nameTh: 'ทองคำเปลวหรูหรา', nameEn: 'Royal Gold', colors: ['#FFF3B0', '#E09F3E', '#9E2A2B'] },
  { id: 'molten-lava', nameTh: 'เพลิงลาวา', nameEn: 'Molten Lava', colors: ['#FFE53B', '#FF2525', '#7A0026'] },
  { id: 'deep-ocean', nameTh: 'คลื่นสมุทรลึก', nameEn: 'Deep Ocean', colors: ['#43E97B', '#38F9D7', '#0052D4'] },
  { id: 'sakura-dusk', nameTh: 'ซากุระยามเย็น', nameEn: 'Sakura Dusk', colors: ['#FFD1DC', '#FF6B9D', '#6A3093'] },
  { id: 'retro-synthwave', nameTh: 'ซินธ์เวฟ 80s', nameEn: 'Retro Synthwave', colors: ['#FF007F', '#8E2DE2', '#00D2FF'] },
  { id: 'emerald-forest', nameTh: 'มรกตป่าฝน', nameEn: 'Emerald Forest', colors: ['#A8FF78', '#24FE41', '#0F766E'] },
  { id: 'peach-sorbet', nameTh: 'ส้มพาสเทลสดใส', nameEn: 'Peach Sorbet', colors: ['#FAD961', '#F76B1C', '#E11D48'] },
  { id: 'frosted-ice', nameTh: 'คริสตัลน้ำแข็ง', nameEn: 'Frosted Ice', colors: ['#E0F2FE', '#38BDF8', '#1D4ED8'] },
  { id: 'cosmic-violet', nameTh: 'ม่วงกาแล็กซี', nameEn: 'Cosmic Violet', colors: ['#F472B6', '#A855F7', '#312E81'] },
  { id: 'electric-lime', nameTh: 'มะนาวไฟฟ้า', nameEn: 'Electric Lime', colors: ['#FACC15', '#84CC16', '#059669'] },
  { id: 'rose-metal', nameTh: 'กุหลาบโลหะ', nameEn: 'Rose Metal', colors: ['#FDE68A', '#F43F5E', '#881337'] },
  { id: 'azure-breeze', nameTh: 'ฟ้าครามเมดิเตอร์เรเนียน', nameEn: 'Azure Breeze', colors: ['#67E8F9', '#3B82F6', '#1E3A8A'] },
  { id: 'dreamy-lavender', nameTh: 'ลาเวนเดอร์ฝันหวาน', nameEn: 'Dreamy Lavender', colors: ['#C4B5FD', '#EC4899', '#FB7185'] },
  { id: 'warm-amber', nameTh: 'อำพันอบอุ่น', nameEn: 'Warm Amber', colors: ['#FEF08A', '#F59E0B', '#B45309'] },
  { id: 'chrome-silver', nameTh: 'เงินโมโนโครม', nameEn: 'Chrome Silver', colors: ['#FFFFFF', '#94A3B8', '#334155'] },
  { id: 'crimson-pulse', nameTh: 'ทับทิมเพลิง', nameEn: 'Crimson Pulse', colors: ['#FDA4AF', '#E11D48', '#4C0519'] },
  { id: 'mint-berry', nameTh: 'มิ้นต์คาราเมล', nameEn: 'Mint & Berry', colors: ['#5EEAD4', '#818CF8', '#C026D3'] },
];

export function getGradientById(id: string): TriColorGradient {
  return TRI_COLOR_GRADIENTS.find((g) => g.id === id) ?? TRI_COLOR_GRADIENTS[0];
}
