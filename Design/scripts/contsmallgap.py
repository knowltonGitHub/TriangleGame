import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Polygon

def draw_pointy_t_container_filled():
    # s = side length of the equilateral triangle unit
    s = 1.0
    h = np.sqrt(3) / 2 # The altitude of the triangle (~0.866)
    
    # Pre-calculated radians for pointy-top vertices (0, 60, 120, 180, 240, 300, 0)
    angles = [0.0, 1.0472, 2.0944, 3.1416, 4.1888, 5.2360, 0.0]
    
    fig, ax = plt.subplots(figsize=(8, 10))
    ax.set_aspect('equal')
    
    def draw_hexagon(cx, cy, label):
        # 1. Internal equilateral triangle mesh
        for i in range(6):
            v1 = [cx, cy]
            v2 = [cx + s * np.cos(angles[i]), cy + s * np.sin(angles[i])]
            v3 = [cx + s * np.cos(angles[i+1]), cy + s * np.sin(angles[i+1])]
            tri = Polygon([v1, v2, v3], closed=True, facecolor='#FDEBD0', edgecolor='black', linewidth=0.5, zorder=1)
            ax.add_patch(tri)
            
        # 2. Thick outer border
        hx = [cx + s * np.cos(a) for a in angles]
        hy = [cy + s * np.sin(a) for a in angles]
        ax.plot(hx, hy, color='black', linewidth=2.5, zorder=2)
        
        # 3. Hexagon number
        ax.text(cx, cy, str(label), fontsize=16, weight='bold', ha='center', va='center', zorder=3)

    def draw_red_infill(v1, v2, v3):
        # Draws the larger equilateral filler triangles
        filler = Polygon([v1, v2, v3], closed=True, facecolor='red', edgecolor='black', linewidth=1.5, zorder=2)
        ax.add_patch(filler)

    # Spacing logic: 2s horizontal (point-to-point), sqrt(3)s vertical (flat-to-flat)
    h_dist = 2.0 * s
    v_dist = 1.73205 * s

    # --- Draw Hexagons ---
    draw_hexagon(-h_dist, 0, 1)
    draw_hexagon(0, 0, 2)
    draw_hexagon(h_dist, 0, 3)
    draw_hexagon(0, v_dist, 4)
    draw_hexagon(0, 2 * v_dist, 5)
    draw_hexagon(0, 3 * v_dist, 6)

    # --- Draw Red Infill Triangles ---
    # These coordinates are derived from the vertices of the adjacent hexagons
    
    # Gaps between Hex 1 and Hex 2
    draw_red_infill([-1.5, h], [-0.5, h], [-1.0, 0])      # Top Red Triangle
    draw_red_infill([-1.5, -h], [-0.5, -h], [-1.0, 0])    # Bottom Red Triangle
    
    # Gaps between Hex 2 and Hex 3
    draw_red_infill([0.5, h], [1.5, h], [1.0, 0])        # Top Red Triangle
    draw_red_infill([0.5, -h], [1.5, -h], [1.0, 0])      # Bottom Red Triangle

    ax.axis('off')
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    plt.close('all') 
    draw_pointy_t_container_filled()