import type { SimplifiedDesign, SimplifiedNode } from '../extractors/types.js';
import type { SimplifiedLayout } from '../transformers/layout.js';
import type { SimplifiedTextStyle } from '../transformers/text.js';
import type { SimplifiedEffects } from '../transformers/effects.js';

/**
 * Renders a SimplifiedDesign into HTML DOM elements
 */
export class FigmaRenderer {
  private globalVars: SimplifiedDesign['globalVars'];

  constructor(private design: SimplifiedDesign) {
    this.globalVars = design.globalVars;
  }

  /**
   * Render the entire design tree
   */
  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'figma-design-root';
    container.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: auto;
      background: #f5f5f5;
    `;

    this.design.nodes.forEach((node) => {
      const element = this.renderNode(node);
      if (element) {
        container.appendChild(element);
      }
    });

    return container;
  }

  /**
   * Recursively render a single node and its children
   */
  private renderNode(node: SimplifiedNode): HTMLElement | null {
    // Skip certain node types that don't render visually
    if (node.type === 'DOCUMENT' || node.type === 'CANVAS') {
      // Render children only
      const fragment = document.createElement('div');
      fragment.className = 'canvas-wrapper';
      node.children?.forEach((child) => {
        const el = this.renderNode(child);
        if (el) fragment.appendChild(el);
      });
      return fragment;
    }

    const element = this.createElementForNode(node);

    // Apply styles
    this.applyLayout(element, node);
    this.applyVisuals(element, node);
    this.applyText(element, node);
    this.applyEffects(element, node);

    // Add debug info
    element.setAttribute('data-node-id', node.id);
    element.setAttribute('data-node-name', node.name);
    element.setAttribute('data-node-type', node.type);
    element.title = `${node.type}: ${node.name}`;

    // Render children
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        const childElement = this.renderNode(child);
        if (childElement) {
          element.appendChild(childElement);
        }
      });
    }

    return element;
  }

  /**
   * Create appropriate HTML element based on node type
   */
  private createElementForNode(node: SimplifiedNode): HTMLElement {
    switch (node.type) {
      case 'TEXT':
        const textEl = document.createElement('div');
        textEl.className = 'figma-text';
        textEl.textContent = node.text || '';
        return textEl;

      case 'IMAGE-SVG':
        const svgContainer = document.createElement('div');
        svgContainer.className = 'figma-svg';
        // SVG content will be loaded separately
        svgContainer.innerHTML = `<div style="background: #ddd; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #666;">SVG: ${node.name}</div>`;
        return svgContainer;

      case 'RECTANGLE':
      case 'ELLIPSE':
      case 'FRAME':
      case 'GROUP':
      case 'COMPONENT':
      case 'INSTANCE':
      case 'SECTION':
      default:
        const div = document.createElement('div');
        div.className = `figma-${node.type.toLowerCase()}`;
        return div;
    }
  }

  /**
   * Apply layout styles (flexbox, positioning, sizing)
   */
  private applyLayout(element: HTMLElement, node: SimplifiedNode): void {
    if (!node.layout) return;

    const layout = this.resolveStyle<SimplifiedLayout>(node.layout);
    if (!layout) return;

    const styles: Record<string, string> = {
      display: 'flex',
      'box-sizing': 'border-box',
    };

    // Flex direction
    if (layout.mode === 'row') {
      styles['flex-direction'] = 'row';
    } else if (layout.mode === 'column') {
      styles['flex-direction'] = 'column';
    } else {
      styles.display = 'block';
    }

    // Justify and align
    if (layout.justifyContent) {
      styles['justify-content'] = layout.justifyContent;
    }
    if (layout.alignItems) {
      styles['align-items'] = layout.alignItems;
    }
    if (layout.alignSelf) {
      styles['align-self'] = layout.alignSelf;
    }

    // Wrap
    if (layout.wrap) {
      styles['flex-wrap'] = 'wrap';
    }

    // Gap
    if (layout.gap) {
      styles['gap'] = layout.gap;
    }

    // Padding
    if (layout.padding) {
      styles['padding'] = layout.padding;
    }

    // Dimensions
    if (layout.dimensions) {
      if (layout.dimensions.width !== undefined) {
        styles['width'] = `${layout.dimensions.width}px`;
      }
      if (layout.dimensions.height !== undefined) {
        styles['height'] = `${layout.dimensions.height}px`;
      }
      if (layout.dimensions.aspectRatio !== undefined) {
        styles['aspect-ratio'] = String(layout.dimensions.aspectRatio);
      }
    }

    // Sizing
    if (layout.sizing) {
      if (layout.sizing.horizontal === 'fill') {
        styles['flex-grow'] = '1';
        styles['width'] = '100%';
      } else if (layout.sizing.horizontal === 'hug') {
        styles['width'] = 'fit-content';
      }

      if (layout.sizing.vertical === 'fill') {
        styles['flex-grow'] = '1';
        styles['height'] = '100%';
      } else if (layout.sizing.vertical === 'hug') {
        styles['height'] = 'fit-content';
      }
    }

    // Position
    if (layout.position === 'absolute') {
      styles['position'] = 'absolute';
      if (layout.locationRelativeToParent) {
        styles['left'] = `${layout.locationRelativeToParent.x}px`;
        styles['top'] = `${layout.locationRelativeToParent.y}px`;
      }
    }

    // Overflow
    if (layout.overflowScroll) {
      if (layout.overflowScroll.includes('x') && layout.overflowScroll.includes('y')) {
        styles['overflow'] = 'auto';
      } else if (layout.overflowScroll.includes('x')) {
        styles['overflow-x'] = 'auto';
      } else if (layout.overflowScroll.includes('y')) {
        styles['overflow-y'] = 'auto';
      }
    }

    // Apply all styles
    Object.entries(styles).forEach(([key, value]) => {
      element.style.setProperty(key, value);
    });
  }

  /**
   * Apply visual styles (fills, strokes, borders, opacity)
   */
  private applyVisuals(element: HTMLElement, node: SimplifiedNode): void {
    // Fills
    if (node.fills) {
      const fills = this.resolveStyle<string | string[]>(node.fills);
      if (fills) {
        if (Array.isArray(fills)) {
          element.style.background = fills.join(', ');
        } else {
          element.style.background = fills;
        }
      }
    }

    // Strokes
    if (node.strokes) {
      const strokes = this.resolveStyle<string>(node.strokes);
      if (strokes) {
        element.style.border = `${node.strokeWeight || '1px'} solid ${strokes}`;
      }
    }

    if (node.strokeDashes && node.strokeDashes.length > 0) {
      element.style.borderStyle = 'dashed';
    }

    // Border radius
    if (node.borderRadius) {
      element.style.borderRadius = node.borderRadius;
    }

    // Opacity
    if (node.opacity !== undefined) {
      element.style.opacity = String(node.opacity);
    }
  }

  /**
   * Apply text styles
   */
  private applyText(element: HTMLElement, node: SimplifiedNode): void {
    if (!node.textStyle) return;

    const textStyle = this.resolveStyle<SimplifiedTextStyle>(node.textStyle);
    if (!textStyle) return;

    if (textStyle.fontFamily) {
      element.style.fontFamily = textStyle.fontFamily;
    }
    if (textStyle.fontWeight) {
      element.style.fontWeight = String(textStyle.fontWeight);
    }
    if (textStyle.fontSize) {
      element.style.fontSize = `${textStyle.fontSize}px`;
    }
    if (textStyle.lineHeight) {
      element.style.lineHeight = textStyle.lineHeight;
    }
    if (textStyle.letterSpacing) {
      element.style.letterSpacing = textStyle.letterSpacing;
    }
    if (textStyle.textCase) {
      element.style.textTransform = textStyle.textCase.toLowerCase() as any;
    }
    if (textStyle.textAlignHorizontal) {
      element.style.textAlign = textStyle.textAlignHorizontal.toLowerCase() as any;
    }
    if (textStyle.textAlignVertical) {
      element.style.alignItems = textStyle.textAlignVertical.toLowerCase() as any;
    }
  }

  /**
   * Apply effects (shadows, blurs)
   */
  private applyEffects(element: HTMLElement, node: SimplifiedNode): void {
    if (!node.effects) return;

    const effects = this.resolveStyle<SimplifiedEffects>(node.effects);
    if (!effects) return;

    if (effects.boxShadow) {
      element.style.boxShadow = effects.boxShadow;
    }
    if (effects.filter) {
      element.style.filter = effects.filter;
    }
    if (effects.backdropFilter) {
      element.style.backdropFilter = effects.backdropFilter;
    }
    if (effects.textShadow) {
      element.style.textShadow = effects.textShadow;
    }
  }

  /**
   * Resolve a style reference to its actual value
   */
  private resolveStyle<T>(styleRef: string): T | null {
    if (!styleRef) return null;

    // If it's a reference to globalVars, resolve it
    if (this.globalVars.styles && this.globalVars.styles[styleRef]) {
      return this.globalVars.styles[styleRef] as T;
    }

    // Otherwise return as-is (it might be a direct value)
    return styleRef as unknown as T;
  }
}

/**
 * Create a renderer and render the design
 */
export function renderFigmaDesign(design: SimplifiedDesign): HTMLElement {
  const renderer = new FigmaRenderer(design);
  return renderer.render();
}
