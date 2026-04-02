import matplotlib.pyplot as plt
import numpy as np

def draw_non_nested_flat_t():
    # 1. Configuration
    radius = 1.0
    
    # Horizontal distance for side-by-side (tip-to-tip is 2r)
    h_spacing = 2.0 * radius 
    
    # Vertical distance for stacking (height of a flat-topped hex)
    v_spacing = np.sqrt(3) * radius
    
    centers = []
    
    # 2. Define the 'T' Layout
    # Base (5 wide) - Hexagons 1 through 5
    for i in range(-2, 3):
        centers.append((i * h_spacing, 0))
    
    # Shaft (3 tall) - Hexagons 6 through 8
    # These are stacked directly on top of Hexagon 3 (the center of the base)
    for i in range(1, 4):
        centers.append((0, i * v_spacing))

    # 3. Setup Plot
    plt.figure(figsize=(10, 8))
    ax = plt.subplot(1, 1, 1)
    ax.set_aspect('equal')
    
    # Flat-topped vertices: 0, 60, …, 360 (duplicate of 0) for closed indexing
    tri_angles = np.deg2rad(np.arange(0, 361, 60))
    
    # 4. Render Hexagons
    for count, (cx, cy) in enumerate(centers):
        hex_id = count + 1
        
        # Draw the 6 internal equilateral triangles
        for i in range(6):
            tx = [cx, cx + radius * np.cos(tri_angles[i]), 
                  cx + radius * np.cos(tri_angles[i+1]), cx]
            ty = [cy, cy + radius * np.sin(tri_angles[i]), 
                  cy + radius * np.sin(tri_angles[i+1]), cy]
            
            # Filling with the 'orange' color from the last image
            ax.fill(tx, ty, alpha=0.4, edgecolor='black', 
                    linewidth=0.5, facecolor='#FFCC80')
            
        # Draw the thick outer hexagon boundary
        hx = [cx + radius * np.cos(a) for a in tri_angles]
        hy = [cy + radius * np.sin(a) for a in tri_angles]
        ax.plot(hx, hy, 'k-', linewidth=2.5)
        
        # Add the ID number in the center
        ax.text(cx, cy, str(hex_id), color='black', fontsize=16, 
                ha='center', va='center', fontweight='bold')

    # 5. Final Cleanup
    title = 'Non-Nested "T" (Flat-Topped Stacking)'
    ax.set_title(title, fontsize=16)
    ax.axis('off')
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    draw_non_nested_flat_t()