import matplotlib.pyplot as plt
import numpy as np

def draw_t_outline():
    # Long leg of the 30-60-90 triangle (l = sqrt(3)/2)
    l = np.sqrt(3) / 2
    
    # 1. Coordinate points for the verified Atomic T
    # Width of Base: 5.0 units (from -2.5 to 2.5)
    # Height of Base: 2 * l (approx 1.732)
    # Width of Shaft: 2.0 units (from -1.0 to 1.0)
    # Height of Shaft: 6 * l above the base (total height 8 * l)
    
    x = [-2.5,  2.5,  2.5,  1.0,  1.0, -1.0, -1.0, -2.5, -2.5]
    y = [ 0,    0,    2*l,  2*l,  8*l,  8*l,  2*l,  2*l,  0]

    plt.figure(figsize=(8, 10))
    ax = plt.subplot(1, 1, 1, aspect='equal')
    
    # Draw only the heavy outline
    ax.plot(x, y, color='black', linewidth=4)
    
    # Clean up the axis for a professional look
    ax.set_xlim(-4, 4)
    ax.set_ylim(-1, 8)
    ax.axis('off')
    
    plt.title("Atomic T-Container Shell")
    plt.show()

if __name__ == "__main__":
    draw_t_outline()