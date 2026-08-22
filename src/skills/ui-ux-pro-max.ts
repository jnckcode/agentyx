/**
 * @file ui-ux-pro-max.ts
 * @description UI/UX Pro Max Design Intelligence Skill Module for Agentyx Swarm
 * @purpose Provides design intelligence rules, curated color palettes, glassmorphism, micro-animations, typography, and UX best practices for agent UI generation.
 * @functions UiUxProMaxSkill - Class providing getSystemDesignRules, getCuratedPalettes methods.
 */

export interface ColorPalette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
}

export class UiUxProMaxSkill {
  public static readonly NAME = 'nextlevelbuilder/ui-ux-pro-max';

  public getCuratedPalettes(): ColorPalette[] {
    return [
      {
        name: 'Cyberpunk Neon Dark',
        primary: '#00F0FF',
        secondary: '#FF007A',
        accent: '#7000FF',
        background: '#0D0E15',
        surface: '#161925',
        text: '#F0F4F8'
      },
      {
        name: 'Midnight Glassmorphism',
        primary: '#6366F1',
        secondary: '#EC4899',
        accent: '#8B5CF6',
        background: '#0F172A',
        surface: 'rgba(30, 41, 59, 0.7)',
        text: '#F8FAFC'
      },
      {
        name: 'Emerald Luxury Dark',
        primary: '#10B981',
        secondary: '#059669',
        accent: '#F59E0B',
        background: '#064E3B',
        surface: '#096347',
        text: '#ECFDF5'
      }
    ];
  }

  public getSystemDesignRules(): string {
    return `
UI/UX PRO MAX DESIGN INTELLIGENCE RULES (nextlevelbuilder/ui-ux-pro-max):
1. Visual Excellence & Aesthetics:
   - Use curated HSL/Hex color palettes (dark modes, sleek glassmorphism, rich gradients). Avoid generic plain colors.
   - Use modern web fonts (Inter, Outfit, Roboto, Fira Code) instead of browser defaults.
   - Add subtle micro-animations (hover transitions, active scale transforms, soft glow effects).
2. Layout & Spacing Hierarchy:
   - Apply consistent grid layouts with 8px/16px padding and border-radius (8px, 12px, 16px).
   - Ensure proper contrast ratio (WCAG AA standard minimum 4.5:1).
3. Component Polish:
   - Glassmorphism: backdrop-filter: blur(12px), border: 1px solid rgba(255,255,255,0.1).
   - Buttons: Active press effects, loading spinners, clear CTA visual cues.
   - Interactive Feedback: Immediate visual state changes for hover, focus, and disabled states.
`;
  }
}

export const uiUxProMaxSkill = new UiUxProMaxSkill();
