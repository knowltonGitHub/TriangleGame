import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Polygon

def draw_pointy_t_container():
    # s = side length
    s = 1.0
    # Pointy-top hex vertices in radians (0, 60, 120, 180, 240, 300, 0)
    angles = [0.0, 1.04719, 2.09439, 3.14159, 4.18879, 5.23598, 0.0]
    
    fig, ax = plt.subplots(figsize=(8, 10))
    ax.set_aspect('equal')
    
    def draw_hexagon(cx, cy, label):
        # 1. Create 6 INDEPENDENT triangle polygons
        # This prevents any "dragging" between points
        for i in range(6):
            v1 = [cx, cy]
            v2 = [cx + s * np.cos(angles[i]), cy + s * np.sin(angles[i])]
            v3 = [cx + s * np.cos(angles[i+1]), cy + s * np.sin(angles[i+1])]
            
            # Add each triangle as a standalone patch
            tri = Polygon([v1, v2, v3], closed=True, facecolor='#FDEBD0', edgecolor='black', linewidth=0.5, zorder=1)
            ax.add_patch(tri)
            
        # 2. Draw the thick outer border as a single closed loop
        hx = [cx + s * np.cos(a) for a in angles]
        hy = [cy + s * np.sin(a) for a in angles]
        ax.plot(hx, hy, color='black', linewidth=2.5, zorder=2)
        
        # 3. Number label
        ax.text(cx, cy, str(label), fontsize=16, weight='bold', ha='center', va='center', zorder=3)

    # Layout Math for Pointy-top touching
    h_dist = 2.0 * s
    v_dist = 1.73205 * s

    # Base (1, 2, 3)
    draw_hexagon(-h_dist, 0, 1)
    draw_hexagon(0, 0, 2)
    draw_hexagon(h_dist, 0, 3)
        
    # Shaft (4, 5, 6)
    draw_hexagon(0, v_dist, 4)
    draw_hexagon(0, 2 * v_dist, 5)
    draw_hexagon(0, 3 * v_dist, 6)

    ax.axis('off')
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    # Force a fresh plot window
    plt.close('all') 
    draw_pointy_t_container()